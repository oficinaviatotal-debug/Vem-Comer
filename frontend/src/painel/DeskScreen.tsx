import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Desk from "../novo/Desk";
import DeskTable from "../novo/DeskTable";
import QrScan from "../novo/QrScan";
import { DESK_ANSWER_ERROR, DESK_LOADING } from "../novo/copy";
import { NO_SCAN_TEXT, scanSupport, type ScanSupport } from "../mesa/tableDeskLogic";
import { alertDevice } from "../service/alertDevice";
import { answerTableCall, fetchAdminOrders, fetchTableCalls, fetchTables } from "../service/api";
import {
  CALLS_MS,
  FIRST_LOOK,
  ORDERS_MS,
  deskTableViewOf,
  deskViewOf,
  nextAlert,
  openCode,
  openTyped,
  parsePanelCalls,
  tableById,
  withoutAnswered,
  type AlertState,
  type PanelCall,
  type RawOrder,
  type TableRef,
} from "./deskLogic";
import { useQrReader } from "./useQrReader";

type Props = {
  companyId: string;
  /** O nome do restaurante no endereço (`?empresa=`): o QR de outro restaurante nunca abre uma mesa daqui. */
  slug: string;
  /** O cardápio de uma mesa, como o cliente vê: onde o garçom pede por quem não usa o celular. */
  tableUrl: (tableId: string) => string;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

/** O que este aparelho sabe fazer com a câmera dentro do aplicativo. */
function detectSupport(): ScanSupport {
  if (typeof window === "undefined") return "none";
  const policy = (document as unknown as { permissionsPolicy?: { allowsFeature(name: string): boolean } }).permissionsPolicy;
  return scanSupport({
    hasDetector: "BarcodeDetector" in window,
    hasCamera: Boolean(navigator.mediaDevices?.getUserMedia),
    secure: window.isSecureContext,
    policyAllows: policy ? policy.allowsFeature("camera") : undefined,
  });
}

/**
 * Mesas de verdade: busca as mesas cadastradas, os chamados abertos e os pedidos andando, e entrega tudo à tela nova.
 * Chamado novo faz o aparelho vibrar e apitar uma vez (e o que vira urgente, mais uma). Uma busca que falha nunca
 * apaga o que já está na tela. "Já atendi" fecha o chamado no servidor e só então o tira da lista: se não deu, o cartão
 * fica e a tela diz o que fazer. Nada aqui muda um pedido nem o dinheiro.
 */
export default function DeskScreen({ companyId, slug, tableUrl, onMenu }: Props) {
  const [tables, setTables] = useState<TableRef[] | null>(null);
  const [tablesFailed, setTablesFailed] = useState(false);
  const [calls, setCalls] = useState<PanelCall[]>([]);
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const support = useMemo(detectSupport, []);
  const alertState = useRef<AlertState>(FIRST_LOOK);
  const answered = useRef<Set<string>>(new Set());
  const answering = useRef(false);
  const firstFocus = useRef(true);

  const loadTables = useCallback(async () => {
    setTablesFailed(false);
    try {
      const rows: unknown = await fetchTables(companyId);
      const list: TableRef[] = Array.isArray(rows)
        ? rows
            .filter((row): row is TableRef => Boolean(row) && typeof row.id === "string" && Number(row.number) > 0)
            .map((row) => ({ id: row.id, number: Number(row.number), status: row.status }))
        : [];
      setTables(list);
    } catch {
      setTablesFailed(true);
    }
  }, [companyId]);

  const loadCalls = useCallback(async () => {
    if (document.hidden) return;
    try {
      const fresh = withoutAnswered(parsePanelCalls(await fetchTableCalls(companyId)), answered.current);
      answered.current = fresh.answered;
      const step = nextAlert(alertState.current, fresh.calls);
      alertState.current = step.state;
      if (step.alert) alertDevice(step.alert);
      setCalls(fresh.calls);
      setNow(Date.now());
    } catch {
      /* sinal fraco: mantém o que está na tela e tenta de novo daqui a pouco, sem fazer barulho */
    }
  }, [companyId]);

  const loadOrders = useCallback(async () => {
    if (document.hidden) return;
    try {
      const rows: unknown = await fetchAdminOrders(companyId);
      if (Array.isArray(rows)) setOrders(rows as RawOrder[]);
    } catch {
      /* idem */
    }
  }, [companyId]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    void loadCalls();
    void loadOrders();
    const callsTimer = window.setInterval(() => void loadCalls(), CALLS_MS);
    const ordersTimer = window.setInterval(() => void loadOrders(), ORDERS_MS);
    const onVisible = () => {
      if (!document.hidden) {
        void loadCalls();
        void loadOrders();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(callsTimer);
      window.clearInterval(ordersTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadCalls, loadOrders]);

  // O foco acompanha a tela: abrir uma mesa leva ao título dela; voltar leva à frase de quantas mesas chamam.
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    document.getElementById(selected ? "nv-desk-table-title" : "nv-desk-live")?.focus();
  }, [selected]);

  const open = useCallback((tableId: string) => {
    setSelected(tableId);
    setTyped("");
    setMessage("");
    setError("");
    setScanning(false);
    window.scrollTo({ top: 0 });
  }, []);

  const onCode = useCallback(
    (text: string) => {
      setScanning(false);
      const result = openCode(tables ?? [], text, slug);
      if ("table" in result) open(result.table.id);
      else setMessage(result.message);
    },
    [tables, slug, open],
  );
  const videoRef = useQrReader(scanning, onCode, (text) => {
    setScanning(false);
    setMessage(text);
  });

  const answer = useCallback(
    async (callId: string) => {
      if (answering.current) return;
      answering.current = true;
      setBusyId(callId);
      setError("");
      try {
        await answerTableCall(companyId, callId);
        answered.current.add(callId);
        setCalls((list) => list.filter((call) => call.id !== callId));
        const known = new Set(alertState.current.known ?? []);
        known.delete(callId);
        alertState.current = { ...alertState.current, known };
        // O cartão que tinha o foco saiu: o foco vai para o próximo botão, ou para a frase de quantas mesas chamam.
        window.requestAnimationFrame(() => {
          const next = document.querySelector<HTMLElement>(".nv-page-desk .nv-deskcall .nv-btn");
          (next ?? document.getElementById("nv-desk-live"))?.focus();
        });
      } catch {
        setError(DESK_ANSWER_ERROR);
        void loadCalls();
      } finally {
        answering.current = false;
        setBusyId(null);
      }
    },
    [companyId, loadCalls],
  );

  const table = selected && tables ? tableById(tables, selected) : null;

  if (table) {
    return (
      <DeskTable
        view={deskTableViewOf({ table, calls, tables: tables ?? [], orders, now, orderHref: tableUrl(table.id), error })}
        busyId={busyId}
        onBack={() => {
          setSelected(null);
          setError("");
        }}
        onAnswer={(id) => void answer(id)}
      />
    );
  }

  return (
    <Desk
      view={deskViewOf({ calls, tables, orders, tablesFailed, message, error })}
      busyId={busyId}
      typed={typed}
      onType={(value) => {
        setTyped(value);
        setMessage("");
      }}
      onSubmitTyped={() => {
        if (!tables) {
          setMessage(DESK_LOADING);
          return;
        }
        const result = openTyped(tables, typed);
        if ("table" in result) open(result.table.id);
        else setMessage(result.message);
      }}
      onOpen={(id) => {
        if (tables && tableById(tables, id)) open(id);
      }}
      onAnswer={(id) => void answer(id)}
      onRetry={() => void loadTables()}
      onScan={
        support === "camera"
          ? () => {
              setMessage("");
              setScanning(true);
            }
          : undefined
      }
      scanNote={support === "camera" ? undefined : NO_SCAN_TEXT}
      scanner={scanning ? <QrScan videoRef={videoRef} onCancel={() => setScanning(false)} /> : undefined}
      onMenu={onMenu}
    />
  );
}
