import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TablePage from "../novo/Table";
import type { Company } from "../customer/types";
import { createCallMemory, isKind, type CallKind } from "../mesa/callsLogic";
import { createTableCall, fetchTableCall, HttpError, mediaUrl } from "../service/api";
import { CALL_POLL_MS, NOTICE_MS, afterCheck, errorTextOf, savedCall, tableViewOf } from "./tableLogic";

type Props = {
  /** O restaurante como o servidor o mostra agora (nome e logomarca). */
  company: Company;
  tableId: string;
  tableNumber: number | null;
  /** Quantos pedidos este aparelho já enviou e o toque em "Acompanhar o seu pedido". */
  ordersCount: number;
  onTrack?: () => void;
  onMenu: () => void;
  /** Endereço do Vem Trabalhar. Só vale se for https; senão o botão não aparece. */
  jobsHref?: string | null;
};

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * A mesa de verdade: um toque manda uma chamada pequena ao servidor (garçom, conta, água ou limpeza) e a tela só
 * pergunta de tempos em tempos se já atenderam (pausa com a aba escondida), para funcionar em sinal fraco. O aparelho
 * lembra o que já chamou (por restaurante e mesa), então recarregar a página não deixa chamar o garçom duas vezes
 * sem querer. Quem desenha é `novo/Table.tsx`; as regras estão em `tableLogic.ts` e em `mesa/callsLogic.ts`.
 */
export default function TableScreen({ company, tableId, tableNumber, ordersCount, onTrack, onMenu, jobsHref = null }: Props) {
  const memory = useMemo(() => createCallMemory(browserStorage()), []);
  const [calls, setCalls] = useState(() => memory.list(company.slug, tableId));
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState<CallKind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const sendingRef = useRef(false);
  const noticeTimer = useRef<number | null>(null);

  const openKey = calls
    .filter((call) => call.status === "open")
    .map((call) => call.id)
    .join(",");

  // Pergunta se já atenderam, só enquanto há chamada aberta e a tela está à vista.
  useEffect(() => {
    if (!openKey) return;
    let alive = true;

    async function check() {
      if (document.hidden) return;
      setNow(Date.now());
      for (const call of memory.list(company.slug, tableId).filter((item) => item.status === "open")) {
        let outcome: ReturnType<typeof afterCheck>;
        try {
          outcome = afterCheck(await fetchTableCall(company.id, tableId, call.id));
        } catch (caught) {
          outcome = afterCheck({ failedWith: caught instanceof HttpError ? caught.status : null });
        }
        if (!alive) return;
        if (outcome !== "wait") setCalls(memory.setStatus(company.slug, tableId, call.id, "answered"));
      }
    }

    const timer = window.setInterval(() => void check(), CALL_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [openKey, memory, company.slug, company.id, tableId]);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const call = useCallback(
    async (kind: CallKind) => {
      if (sendingRef.current || !isKind(kind)) return;
      sendingRef.current = true;
      setSending(kind);
      setError("");
      try {
        const saved = savedCall(await createTableCall(company.id, tableId, kind));
        if (!saved) throw new Error("incomplete");
        setCalls(memory.put(company.slug, tableId, { id: saved.id, kind: saved.kind, status: "open" }));
        setNow(Date.now());
        setNotice(saved.message);
        try {
          navigator.vibrate?.(40);
        } catch {
          /* sem vibração neste aparelho */
        }
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(""), NOTICE_MS);
      } catch (caught) {
        const status = caught instanceof HttpError ? caught.status : null;
        const message = caught instanceof Error ? caught.message : null;
        setNotice("");
        setError(errorTextOf(status, message));
      } finally {
        sendingRef.current = false;
        setSending(null);
      }
    },
    [company.id, company.slug, tableId, memory],
  );

  const view = useMemo(
    () => tableViewOf({ tableNumber, calls, now, sending, notice, error, ordersCount, jobsHref }),
    [tableNumber, calls, now, sending, notice, error, ordersCount, jobsHref],
  );

  const logo = mediaUrl(company.logo_thumb_url);
  return (
    <TablePage
      shop={{ name: company.name, logo: logo || undefined }}
      view={view}
      onCall={(kind) => void call(kind)}
      onMenu={onMenu}
      onTrack={onTrack}
    />
  );
}
