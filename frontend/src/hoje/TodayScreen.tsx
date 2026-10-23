import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OwnerToday from "../novo/OwnerToday";
import type { TodoItem } from "../novo/types";
import { fetchBusiness } from "../business/businessApi";
import type { BusinessView } from "../business/businessLogic";
import { parsePanelCalls, type PanelCall } from "../mesa/callsLogic";
import { isManager } from "../nav/navLogic";
import { answerTableCall, fetchAdminOrders, fetchPixSettings, fetchProducts, fetchTableCalls, fetchTables } from "../service/api";
import { NO_FACTS, VIEWS, countOf, todayOf, withoutPhotoOf, type SetupFacts, type TodayOrder } from "./todayLogic";

type Props = {
  companyId: string;
  role: string | null | undefined;
  name: string;
  /** Leva a outra tela do painel ("pedidos", "mesas", ...). */
  onGo: (view: string) => void;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
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
export default function TodayScreen({ companyId, role, name, onGo, onMenu }: Props) {
  const [orders, setOrders] = useState<TodayOrder[]>([]);
  const [calls, setCalls] = useState<PanelCall[]>([]);
  const [business, setBusiness] = useState<BusinessView | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupFacts>(NO_FACTS);
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

  /**
   * O que falta montar: cada pergunta ao servidor vale sozinha. Se uma falha, o que já se sabia fica e o resto segue; nunca se conclui "falta" de uma busca que falhou.
   * Só dono e gerente veem a lista, então só eles fazem estas buscas.
   */
  const loadSetup = useCallback(async () => {
    if (document.hidden || !isManager(role)) return;
    const [products, tables, pix] = await Promise.allSettled([fetchProducts(companyId), fetchTables(companyId), fetchPixSettings(companyId)]);
    setSetup((before) => ({
      products: products.status === "fulfilled" ? countOf(products.value) : before.products,
      withoutPhoto: products.status === "fulfilled" ? withoutPhotoOf(products.value) : before.withoutPhoto,
      tables: tables.status === "fulfilled" ? countOf(tables.value) : before.tables,
      pix: pix.status === "fulfilled" && typeof pix.value?.configured === "boolean" ? pix.value.configured : before.pix,
    }));
  }, [companyId, role]);

  useEffect(() => {
    void loadOrders();
    void loadCalls();
    void loadSales();
    void loadSetup();
    const timers = [
      window.setInterval(() => void loadOrders(), ORDERS_MS),
      window.setInterval(() => void loadCalls(), CALLS_MS),
      window.setInterval(() => void loadSales(), SALES_MS),
      window.setInterval(() => void loadSetup(), SALES_MS),
    ];
    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
      salesTicket.current += 1;
    };
  }, [loadOrders, loadCalls, loadSales, loadSetup]);

  const today = useMemo(
    () => todayOf({ name, role, orders, calls, business, businessError: business ? null : businessError, setup, now }),
    [name, role, orders, calls, business, businessError, setup, now],
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
      onMenu={onMenu}
      busyId={busyId}
      error={actionError ?? (offline ? "Sem conexão com o servidor. Os números na tela podem estar desatualizados." : null)}
    />
  );
}
