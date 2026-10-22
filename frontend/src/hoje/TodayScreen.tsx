import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OwnerToday from "../novo/OwnerToday";
import type { TodoItem } from "../novo/types";
import { fetchBusiness } from "../business/businessApi";
import type { BusinessView } from "../business/businessLogic";
import { parsePanelCalls, type PanelCall } from "../mesa/callsLogic";
import { answerTableCall, fetchAdminOrders, fetchTableCalls } from "../service/api";
import { VIEWS, todayOf, type TodayOrder } from "./todayLogic";

type Props = {
  companyId: string;
  role: string | null | undefined;
  name: string;
  /** Leva a outra tela do painel ("pedidos", "mesas", ...). */
  onGo: (view: string) => void;
};

/** De quanto em quanto tempo cada pedaço da tela pergunta ao servidor. */
const ORDERS_MS = 5000;
const CALLS_MS = 6000;
const SALES_MS = 60000;
const FAILED_SALES = "Não consegui abrir as vendas agora. Mostro de novo em instantes.";

/**
 * O "Hoje" de verdade: busca os pedidos, as mesas chamando e as vendas do dia e entrega tudo à tela nova.
 * Uma busca que falha nunca apaga o que já está na tela: o dono continua vendo os últimos números.
 */
export default function TodayScreen({ companyId, role, name, onGo }: Props) {
  const [orders, setOrders] = useState<TodayOrder[]>([]);
  const [calls, setCalls] = useState<PanelCall[]>([]);
  const [business, setBusiness] = useState<BusinessView | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // A resposta mais nova vence: uma resposta lenta nunca cobre uma mais recente.
  const salesTicket = useRef(0);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchAdminOrders(companyId);
      setOrders(Array.isArray(data) ? data : []);
      setOffline(false);
      setNow(Date.now());
    } catch (err) {
      console.error(err);
      setOffline(true);
    }
  }, [companyId]);

  const loadCalls = useCallback(async () => {
    if (document.hidden) return;
    try {
      setCalls(parsePanelCalls(await fetchTableCalls(companyId)));
    } catch (err) {
      console.error(err);
    }
  }, [companyId]);

  const loadSales = useCallback(async () => {
    if (document.hidden) return;
    const ticket = ++salesTicket.current;
    try {
      const view = await fetchBusiness(companyId, "hoje");
      if (ticket !== salesTicket.current) return;
      setBusiness(view);
      setBusinessError(null);
    } catch (err) {
      if (ticket !== salesTicket.current) return;
      console.error(err);
      setBusinessError(FAILED_SALES);
    }
  }, [companyId]);

  useEffect(() => {
    void loadOrders();
    void loadCalls();
    void loadSales();
    const timers = [
      window.setInterval(() => void loadOrders(), ORDERS_MS),
      window.setInterval(() => void loadCalls(), CALLS_MS),
      window.setInterval(() => void loadSales(), SALES_MS),
    ];
    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
      salesTicket.current += 1;
    };
  }, [loadOrders, loadCalls, loadSales]);

  const today = useMemo(
    () => todayOf({ name, role, orders, calls, business, businessError: business ? null : businessError, now }),
    [name, role, orders, calls, business, businessError, now],
  );

  async function handleTodo(item: TodoItem) {
    if (item.kind === "pix") {
      onGo(VIEWS.orders);
      return;
    }
    if (busyId) return;
    setBusyId(item.id);
    setActionError(null);
    try {
      await answerTableCall(companyId, item.id);
      await loadCalls();
    } catch (err) {
      console.error(err);
      setActionError("Não deu para marcar a mesa como atendida. Toque no botão de novo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <OwnerToday
      today={today}
      onGo={onGo}
      onTodo={(item) => void handleTodo(item)}
      busyId={busyId}
      error={actionError ?? (offline ? "Sem conexão com o servidor. Os números na tela podem estar desatualizados." : null)}
    />
  );
}
