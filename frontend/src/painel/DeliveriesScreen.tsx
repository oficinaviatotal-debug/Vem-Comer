import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Deliveries, { type DeliveriesBusy, type DeliveryForm, type DeliveryNote } from "../novo/Deliveries";
import { DELIVERIES_LOAD_ERROR, DELIVERIES_OFFLINE, DELIVERIES_PICK_ERROR } from "../novo/copy";
import { deliverOrder, fetchCourierOrders, pickUpOrder } from "../courier/courierApi";
import { codeIsComplete, deliveredText, groupOrders, onlyCodeDigits, stageOf } from "../courier/courierLogic";
import { alertDevice } from "../service/alertDevice";
import { HttpError } from "../service/api";
import { knownOrderIds, newOrders } from "../service/newOrders";
import { DELIVERIES_POLL_MS, deliveriesViewOf, firstDeliveriesTab, pickedText, type CourierOrder } from "./deliveriesLogic";

type Props = {
  companyId: string;
  /** O menu do painel. Sem ele o botão de menu não aparece (o entregador tem só esta tela). */
  onMenu?: () => void;
};

/** Frase do erro do servidor quando há (ele escreve em português); sem resposta, a frase de "sem sinal". */
const wordsOf = (error: unknown, fallback: string): string => (error instanceof HttpError && error.status > 0 ? error.message : fallback);

/**
 * Entregas de verdade: pergunta ao servidor a cada 10 s (só com a tela à vista, para poupar a bateria do motoqueiro),
 * apita quando aparece entrega nova para pegar, pega ("Peguei") e fecha ("Entreguei") com os 4 números do cliente.
 * Um toque por vez. Quem decide é o servidor: quem pode pegar, se o código está certo, quantas tentativas sobram.
 * Uma busca que falha nunca apaga a lista; depois de entregar com a internet caindo, repetir é seguro (o servidor
 * responde "já estava fechada").
 */
export default function DeliveriesScreen({ companyId, onMenu }: Props) {
  const [orders, setOrders] = useState<CourierOrder[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState<DeliveriesBusy>(null);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<{ id: string; code: string } | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [note, setNote] = useState<DeliveryNote>(null);
  const alive = useRef(true);
  const working = useRef(false);
  const latest = useRef<CourierOrder[] | null>(null);
  /** As entregas que esperavam ser pegas na última busca; null até a primeira (abrir a tela não faz barulho). */
  const knownReady = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchCourierOrders(companyId);
      if (!alive.current) return;
      const waiting = groupOrders(rows).ready;
      if (newOrders(knownReady.current, waiting).length > 0) alertDevice("ready");
      knownReady.current = knownOrderIds(waiting);
      latest.current = rows;
      setOrders(rows);
      // A etapa que abre sozinha é escolhida UMA vez, na primeira resposta: depois disso a lista não pula de aba debaixo do dedo.
      setChosen((current) => current ?? firstDeliveriesTab(groupOrders(rows)));
      setProblem("");
    } catch (error) {
      if (!alive.current) return;
      setProblem(wordsOf(error, DELIVERIES_LOAD_ERROR));
    }
  }, [companyId]);

  useEffect(() => {
    alive.current = true;
    void load();
    const poll = window.setInterval(() => {
      if (!document.hidden) void load();
    }, DELIVERIES_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // O campo do código se fecha sozinho quando a entrega deixa de estar na rua com ele (o restaurante fechou, ou já foi entregue).
  useEffect(() => {
    if (open && orders && !orders.some((order) => order.id === open.id && stageOf(order) === "going")) setOpen(null);
  }, [orders, open]);

  /** O foco vai para a entrega que acabou de mudar, ou para o próximo botão, ou para a frase de cima. */
  const refocus = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      const same = document.getElementById(`nv-delivery-${id}`);
      const next = document.querySelector<HTMLElement>(".nv-page-deliveries .nv-order .nv-btn");
      (same ?? next ?? document.getElementById("nv-deliveries-live"))?.focus();
    });
  }, []);

  const pick = useCallback(
    async (id: string) => {
      if (working.current) return;
      const seen = latest.current?.find((order) => order.id === id);
      if (!seen) return;
      working.current = true;
      setBusy({ id, kind: "pick" });
      setNotice("");
      setNote(null);
      try {
        await pickUpOrder(companyId, id);
        setNotice(pickedText(seen));
      } catch (error) {
        setNote({ id, text: wordsOf(error, DELIVERIES_PICK_ERROR) });
      } finally {
        working.current = false;
        setBusy(null);
      }
      await load();
      refocus(id);
    },
    [companyId, load, refocus],
  );

  const confirm = useCallback(
    async (id: string) => {
      if (working.current || !open || open.id !== id) return;
      const seen = latest.current?.find((order) => order.id === id);
      if (!seen || (seen.needs_code && !codeIsComplete(open.code))) return;
      working.current = true;
      setBusy({ id, kind: "deliver" });
      setNote(null);
      try {
        const result = await deliverOrder(companyId, id, seen.needs_code ? open.code : "");
        if (!alive.current) return;
        if (result.kind === "done") {
          setNotice(deliveredText(result));
          setOpen(null);
          await load();
          refocus(id);
          return;
        }
        if (result.kind === "locked") {
          setLocked((current) => (current.includes(id) ? current : [...current, id]));
          setOpen((current) => (current ? { ...current, code: "" } : current));
          return;
        }
        // Código errado, sem sinal ou recusa: fica no campo, apaga o que foi digitado para a próxima tentativa começar limpa.
        setNote({ id, text: result.kind === "offline" ? DELIVERIES_OFFLINE : result.message });
        if (result.kind === "wrong") setOpen((current) => (current ? { ...current, code: "" } : current));
        if (result.kind === "error") await load();
      } finally {
        working.current = false;
        setBusy(null);
      }
    },
    [companyId, open, load, refocus],
  );

  const view = useMemo(() => deliveriesViewOf({ orders, chosen, error: problem, notice }), [orders, chosen, problem, notice]);

  const form: DeliveryForm = useMemo(() => {
    if (!open) return null;
    const order = orders?.find((entry) => entry.id === open.id);
    return { id: open.id, code: open.code, ready: !order?.needs_code || codeIsComplete(open.code), locked: locked.includes(open.id) };
  }, [open, orders, locked]);

  return (
    <Deliveries
      view={view}
      busy={busy}
      form={form}
      note={note}
      onTab={(id) => {
        setChosen(id);
        setNote(null);
        setNotice("");
      }}
      onPick={(id) => void pick(id)}
      onOpen={(id) => {
        setOpen({ id, code: "" });
        setNote(null);
        setNotice("");
      }}
      onCode={(code) => {
        setOpen((current) => (current ? { ...current, code: onlyCodeDigits(code) } : current));
        setNote(null);
      }}
      onConfirm={(id) => void confirm(id)}
      onCloseForm={() => {
        const id = open?.id;
        setOpen(null);
        setNote(null);
        if (id) refocus(id);
      }}
      onMenu={onMenu}
    />
  );
}
