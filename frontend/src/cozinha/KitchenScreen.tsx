import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Kitchen from "../novo/Kitchen";
import { alertDevice } from "../service/alertDevice";
import { fetchAdminOrders, updateOrderStatus } from "../service/api";
import { knownOrderIds, newOrders, wantsNewOrderAlert } from "../service/newOrders";
import {
  advanceOf,
  emptyText,
  firstTabWithOrders,
  isKitchenTab,
  kitchenTabs,
  ticketsFor,
  type KitchenOrder,
  type KitchenTabId,
} from "./kitchenLogic";

type Props = {
  companyId: string;
  /** Papel de quem está logado (OWNER, KITCHEN, ...): o entregador não recebe o apito de pedido novo. */
  role?: string | null;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

/** A cozinha de verdade: busca os pedidos do restaurante a cada 5 s, apita no pedido novo e troca o status. */
const POLL_MS = 5000;
/** Os minutos de espera andam sozinhos, mesmo sem pedido novo. */
const CLOCK_MS = 30000;

export default function KitchenScreen({ companyId, role = null, onMenu }: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [chosen, setChosen] = useState<KitchenTabId | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminOrders(companyId);
      const current: KitchenOrder[] = Array.isArray(data) ? data : [];
      // Por número do pedido, não por quantidade: o servidor manda só os 200 mais recentes.
      if (newOrders(known.current, current).length > 0 && wantsNewOrderAlert(role)) alertDevice("order");
      known.current = knownOrderIds(current);
      setOrders(current);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Sem conexão com o servidor. Os pedidos na tela podem estar desatualizados.");
    }
  }, [companyId, role]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), POLL_MS);
    const clock = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [load]);

  const active: KitchenTabId = chosen ?? firstTabWithOrders(orders);
  const tabs = useMemo(() => kitchenTabs(orders), [orders]);
  const tickets = useMemo(() => ticketsFor(orders, active, now), [orders, active, now]);

  async function handleAction(id: string) {
    const order = orders.find((entry) => entry.id === id);
    const step = order ? advanceOf(order) : null;
    if (!order || !step || busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await updateOrderStatus(id, step.next);
      await load();
    } catch (err) {
      console.error(err);
      setError("Não foi possível mudar o pedido. Toque no botão de novo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Kitchen
      tabs={tabs}
      activeTab={active}
      tickets={tickets}
      onTab={(id) => (isKitchenTab(id) ? setChosen(id) : undefined)}
      onAction={(id) => void handleAction(id)}
      busyId={busyId}
      error={error}
      emptyText={emptyText(active)}
      onMenu={onMenu}
    />
  );
}
