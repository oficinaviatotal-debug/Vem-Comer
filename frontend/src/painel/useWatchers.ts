import { useCallback, useEffect, useRef, useState } from "react";
import { becameUrgent, freshCalls, parsePanelCalls, type Urgency } from "../mesa/callsLogic";
import { alertDevice } from "../service/alertDevice";
import { fetchPlatformHelp } from "../service/helpApi";
import { fetchApprovals } from "../service/approvalsApi";
import { fetchAdminOrders, fetchTableCalls } from "../service/api";
import { knownOrderIds, newOrders } from "../service/newOrders";
import { isActiveStatus } from "../service/orderStatus";
import { CALLS_WATCH_MS, ORDERS_WATCH_MS } from "./shellLogic";

type OrderRow = { id: string; status: string };

/**
 * O painel olha os pedidos quando a tela da vez não olha: conta os em aberto (o número do menu) e, se `alert`, avisa o
 * pedido novo (apito e faixa). A primeira resposta nunca faz alarde (o que já estava lá ao abrir não é novo). Uma busca
 * que falha não apaga o número que já se sabia.
 */
export function useOrdersWatch(companyId: string, options: { poll: boolean; alert: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const alertRef = useRef(options.alert);
  alertRef.current = options.alert;

  useEffect(() => {
    if (!options.poll) {
      // Parado: quando voltar a olhar, a primeira resposta é só o ponto de partida.
      known.current = null;
      setFresh(false);
      return;
    }
    let alive = true;
    const look = async () => {
      try {
        const data = await fetchAdminOrders(companyId);
        if (!alive) return;
        const rows: OrderRow[] = Array.isArray(data) ? data : [];
        if (newOrders(known.current, rows).length > 0 && alertRef.current) {
          setFresh(true);
          alertDevice("order");
        }
        known.current = knownOrderIds(rows);
        setOpen(rows.filter((row) => isActiveStatus(row.status)).length);
      } catch {
        /* sinal fraco: tenta de novo daqui a pouco, sem fazer barulho */
      }
    };
    void look();
    const timer = window.setInterval(() => void look(), ORDERS_WATCH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [companyId, options.poll]);

  const clear = useCallback(() => setFresh(false), []);
  return { open, fresh, clear };
}

/**
 * O painel olha as mesas que chamam: conta quantas e faz o aparelho vibrar e apitar numa chamada nova (e mais uma vez
 * quando a espera passa do limite). O que já estava aberto ao ligar não faz alarde.
 */
export function useCallsWatch(companyId: string, enabled: boolean): number {
  const [count, setCount] = useState(0);
  const known = useRef<Set<string> | null>(null);
  const urgencies = useRef<Map<string, Urgency>>(new Map());

  useEffect(() => {
    if (!enabled) {
      known.current = null;
      urgencies.current = new Map();
      setCount(0);
      return;
    }
    let alive = true;
    const look = async () => {
      if (document.hidden) return;
      try {
        const calls = parsePanelCalls(await fetchTableCalls(companyId));
        if (!alive) return;
        const arrived = freshCalls(known.current, calls);
        const urgent = becameUrgent(urgencies.current, calls);
        if (arrived.length > 0) alertDevice(arrived.some((call) => call.urgency === "urgent") ? "urgent" : "call");
        else if (urgent.length > 0) alertDevice("urgent");
        known.current = new Set(calls.map((call) => call.id));
        urgencies.current = new Map(calls.map((call) => [call.id, call.urgency]));
        setCount(calls.length);
      } catch {
        /* sinal fraco: tenta de novo daqui a pouco, sem fazer barulho */
      }
    };
    void look();
    const timer = window.setInterval(() => void look(), CALLS_WATCH_MS);
    const onVisible = () => {
      if (!document.hidden) void look();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [companyId, enabled]);

  return count;
}

/** Só o dono do sistema: quantos chamados e quantas aprovações esperam (os números do menu). `null` até o servidor dizer. */
export function usePlatformCounts(enabled: boolean) {
  const [help, setHelp] = useState<number | null>(null);
  const [approvals, setApprovals] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchPlatformHelp()
      .then((value) => {
        if (alive) setHelp(value.open_count);
      })
      .catch(() => undefined); // o número é um favor: a tela abre e diz o que deu errado
    const load = () =>
      fetchApprovals()
        .then((value) => {
          if (alive) setApprovals(value.pending_count);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return { help, approvals, setHelp, setApprovals };
}
