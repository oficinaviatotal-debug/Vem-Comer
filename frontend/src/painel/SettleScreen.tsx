import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Settle from "../novo/Settle";
import { SETTLE_CHANGED, SETTLE_ERROR, SETTLE_LOAD_ERROR } from "../novo/copy";
import { fetchCourierCash, settleCourierCash } from "../courier/courierApi";
import { settledText, type CashView } from "../courier/courierLogic";
import { HttpError } from "../service/api";
import { ARM_MS, armKey, markedIds, settleCheck, settleViewOf, toggleLeft } from "./settleLogic";

type Props = {
  companyId: string;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

/** Frase do erro do servidor quando há (ele escreve em português); sem resposta, a frase de "sem sinal". */
const wordsOf = (error: unknown, fallback: string): string => (error instanceof HttpError && error.status > 0 ? error.message : fallback);

/**
 * Acerto do caixa de verdade. A lista NÃO se atualiza sozinha (o total que o caixa contou não pode mudar debaixo dele);
 * só ao abrir, ao tocar em atualizar e depois de acertar. Acertar leva dois toques no mesmo botão e valor; antes de mandar,
 * a tela olha o servidor de novo: se uma entrega marcada já foi acertada ou mudou de valor, não manda e avisa.
 */
export default function SettleScreen({ companyId, onMenu }: Props) {
  const [cash, setCash] = useState<CashView | null>(null);
  const [left, setLeft] = useState<string[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(true);
  const working = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const next = await fetchCourierCash(companyId);
      if (!alive.current) return null;
      setCash(next);
      setError("");
      return next;
    } catch (failure) {
      if (alive.current) setError(wordsOf(failure, SETTLE_LOAD_ERROR));
      return null;
    }
  }, [companyId]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, [load]);

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(null);
  }, []);

  const settle = useCallback(
    async (groupId: string) => {
      if (working.current || !cash) return;
      const group = cash.couriers.find((entry) => entry.courier_id === groupId);
      if (!group) return;
      const ids = markedIds(group, left);
      if (ids.length === 0) return;
      working.current = true;
      setBusy(groupId);
      setNotice("");
      setError("");
      try {
        const fresh = await fetchCourierCash(companyId);
        if (!alive.current) return;
        if (settleCheck(group, left, fresh) === "changed") {
          setCash(fresh);
          setLeft([]);
          setError(SETTLE_CHANGED);
          return;
        }
        const result = await settleCourierCash(companyId, groupId, ids);
        if (!alive.current) return;
        setNotice(settledText(result));
        setLeft([]);
        await load();
      } catch (failure) {
        if (alive.current) setError(wordsOf(failure, SETTLE_ERROR));
      } finally {
        working.current = false;
        if (alive.current) setBusy(null);
        window.requestAnimationFrame(() => {
          const same = document.getElementById(`nv-settle-${groupId}`);
          const next = document.querySelector<HTMLElement>(".nv-page-settle .nv-order .nv-btn");
          (same ?? next ?? document.getElementById("nv-settle-live"))?.focus();
        });
      }
    },
    [cash, companyId, left, load],
  );

  const view = useMemo(() => settleViewOf({ cash, left, armed, error, notice }), [cash, left, armed, error, notice]);

  return (
    <Settle
      view={view}
      busy={busy}
      onToggle={(_groupId, orderId) => {
        setLeft((current) => toggleLeft(current, orderId));
        setNotice("");
        disarm();
      }}
      onSettle={(groupId) => {
        const group = cash?.couriers.find((entry) => entry.courier_id === groupId);
        if (!group || working.current || markedIds(group, left).length === 0) return;
        const key = armKey(group, left);
        if (armed !== key) {
          // Primeiro toque: guarda este valor e espera o segundo por alguns segundos. Ninguém acerta dinheiro com um toque só.
          window.clearTimeout(timer.current);
          setArmed(key);
          timer.current = window.setTimeout(() => setArmed(null), ARM_MS);
          return;
        }
        disarm();
        void settle(groupId);
      }}
      onRefresh={() => {
        setNotice("");
        disarm();
        void load();
      }}
      onMenu={onMenu}
    />
  );
}
