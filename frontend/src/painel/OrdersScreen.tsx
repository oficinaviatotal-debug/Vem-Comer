import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Orders, { type OrdersBusy } from "../novo/Orders";
import { ORDERS_ADVANCE_ERROR, ORDERS_LOAD_ERROR, ORDERS_RECEIVE_ERROR } from "../novo/copy";
import { alertDevice } from "../service/alertDevice";
import { confirmPayment, fetchAdminOrders, updateOrderStatus } from "../service/api";
import { knownOrderIds, newOrders, wantsNewOrderAlert } from "../service/newOrders";
import {
  CLOCK_MS,
  ORDERS_CHANGED,
  ORDERS_POLL_MS,
  moveCheck,
  nextStatusOf,
  ordersViewOf,
  payCheck,
  type PanelOrder,
} from "./ordersLogic";

type Props = {
  companyId: string;
  /** Papel de quem está logado (OWNER, MANAGER, CASHIER, WAITER...): decide as abas, os botões e o que se vê do cliente. */
  role?: string | null;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

const asOrders = (data: unknown): PanelOrder[] => (Array.isArray(data) ? (data as PanelOrder[]) : []);

/**
 * Pedidos e caixa de verdade: busca os pedidos do restaurante a cada 5 s (como a tela antiga e a cozinha, também com a
 * aba escondida, para o aparelho apitar pedido novo), apita no pedido novo, avança o pedido e confirma o pagamento.
 * Cada toque olha o pedido no servidor antes de mandar: se outra pessoa já mexeu, a tela atualiza e diz, sem levar o
 * pedido para trás. Uma busca que falha nunca apaga o que já está na tela. Um toque por vez.
 */
export default function OrdersScreen({ companyId, role = null, onMenu }: Props) {
  const [orders, setOrders] = useState<PanelOrder[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<OrdersBusy>(null);
  const [actionError, setActionError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const latest = useRef<PanelOrder[]>([]);
  const working = useRef(false);

  /** Passa a valer a lista que o servidor mandou: apita o que for novo e lembra o que a tela já conhece. */
  const adopt = useCallback(
    (current: PanelOrder[]) => {
      // Por número do pedido, não por quantidade: o servidor manda só os 200 mais recentes.
      if (newOrders(known.current, current).length > 0 && wantsNewOrderAlert(role)) alertDevice("order");
      known.current = knownOrderIds(current);
      latest.current = current;
      setOrders(current);
      setNow(Date.now());
    },
    [role],
  );

  const load = useCallback(async () => {
    try {
      adopt(asOrders(await fetchAdminOrders(companyId)));
      setLoadFailed(false);
    } catch {
      /* sinal fraco: mantém o que está na tela e tenta de novo daqui a pouco. A frase de "sem conexão" vale mais que a de um toque que falhou antes. */
      setLoadFailed(true);
      setActionError("");
    }
  }, [companyId, adopt]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), ORDERS_POLL_MS);
    const clock = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const act = useCallback(
    async (id: string, kind: "advance" | "skip" | "receive") => {
      if (working.current) return;
      const seen = latest.current.find((order) => order.id === id);
      if (!seen) return;
      const target = kind === "receive" ? null : nextStatusOf(seen, kind);
      if (kind !== "receive" && !target) return;
      working.current = true;
      setBusy({ id, kind });
      setActionError("");
      try {
        const fresh = asOrders(await fetchAdminOrders(companyId));
        const verdict = kind === "receive" ? payCheck(seen, fresh) : moveCheck(seen, fresh);
        if (verdict === "changed") {
          adopt(fresh);
          setLoadFailed(false);
          setActionError(ORDERS_CHANGED);
          return;
        }
        if (kind === "receive") await confirmPayment(id);
        else await updateOrderStatus(id, target as string);
        await load();
        // O cartão que tinha o foco pode ter saído desta aba: o foco vai para ele, ou para o próximo botão, ou para a frase de cima.
        window.requestAnimationFrame(() => {
          const same = document.getElementById(`nv-order-${id}`);
          const next = document.querySelector<HTMLElement>(".nv-page-orders .nv-order .nv-btn");
          (same ?? next ?? document.getElementById("nv-orders-live"))?.focus();
        });
      } catch {
        setActionError(kind === "receive" ? ORDERS_RECEIVE_ERROR : ORDERS_ADVANCE_ERROR);
        void load();
      } finally {
        working.current = false;
        setBusy(null);
      }
    },
    [companyId, adopt, load],
  );

  const view = useMemo(
    () => ordersViewOf({ orders, role, now, chosen, error: actionError || (loadFailed ? ORDERS_LOAD_ERROR : "") }),
    [orders, role, now, chosen, actionError, loadFailed],
  );

  return (
    <Orders
      view={view}
      busy={busy}
      onTab={(id) => {
        setChosen(id);
        setActionError("");
      }}
      onAction={(id, which) => void act(id, which)}
      onReceive={(id) => void act(id, "receive")}
      onMenu={onMenu}
    />
  );
}
