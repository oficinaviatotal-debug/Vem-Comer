import { useCallback, useEffect, useRef, useState } from "react";
import { TrackSlip, TrackWaiting, TrackingPage } from "../novo/Tracking";
import { orderMemory, type RememberedOrder } from "../customer/orderMemory";
import type { Company, OrderView } from "../customer/types";
import { copyText } from "../service/clipboard";
import { createFeedback, fetchOrder, fetchOrderPix, HttpError } from "../service/api";
import {
  COMMENT_MAX,
  LOADING_TEXT,
  OFFLINE_FIRST_TEXT,
  POLL_MS,
  RATING_ERROR,
  afterPoll,
  copiedOutcome,
  pixOf,
  pixStateOfError,
  ratingOf,
  ratingTarget,
  trackOf,
} from "./trackingLogic";
import type { Pix } from "../novo/types";

type Props = {
  company: Company;
  /** Quem entrou pelo QR da mesa: o número da mesa, ou null. */
  tableNumber: number | null;
  /** Os pedidos deste aparelho, do mais novo para o mais antigo. */
  orders: RememberedOrder[];
  onBack: () => void;
  /** O servidor não conhece mais o pedido, ou a pessoa fechou: o aparelho o esquece. */
  onForget: (orderId: string) => void;
};

/**
 * O acompanhamento de verdade: um comprovante por pedido, cada um perguntando ao servidor como está a cada poucos segundos
 * (e mais devagar, ou nada, com a aba escondida). Para quando não há mais o que esperar.
 */
export default function TrackingScreen({ company, tableNumber, orders, onBack, onForget }: Props) {
  // Quais pedidos já estão prontos (para saber quem pede a avaliação) e um empurrão para redesenhar quando alguém avalia.
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [, redraw] = useState(0);
  const target = ratingTarget(
    orders.map((order) => order.orderId),
    (id) => done[id] === true,
    (id) => orderMemory.feedbackSent(id),
  );
  const allIds = orders.map((order) => order.orderId);

  const onDone = useCallback((id: string, isDone: boolean) => {
    setDone((current) => (current[id] === isDone ? current : { ...current, [id]: isDone }));
  }, []);

  return (
    <TrackingPage sub={company.name} onBack={onBack}>
      {orders.map((order) => (
        <TrackedOrder
          key={order.orderId}
          companyId={company.id}
          order={order}
          tableNumber={tableNumber}
          rateHere={target === order.orderId}
          allIds={allIds}
          onDone={onDone}
          onRated={() => redraw((n) => n + 1)}
          onGone={() => onForget(order.orderId)}
        />
      ))}
      <button type="button" className="nv-btn is-ghost is-block" onClick={onBack}>
        Voltar ao cardápio
      </button>
    </TrackingPage>
  );
}

type OrderProps = {
  companyId: string;
  order: RememberedOrder;
  tableNumber: number | null;
  rateHere: boolean;
  allIds: string[];
  onDone: (id: string, done: boolean) => void;
  onRated: () => void;
  onGone: () => void;
};

function TrackedOrder({ companyId, order: remembered, tableNumber, rateHere, allIds, onDone, onRated, onGone }: OrderProps) {
  const { orderId, token } = remembered;
  const [order, setOrder] = useState<OrderView | null>(null);
  const [offline, setOffline] = useState(false);
  const goneRef = useRef(onGone);
  const doneRef = useRef(onDone);
  goneRef.current = onGone;
  doneRef.current = onDone;

  // Pergunta ao servidor até não haver mais o que esperar. Aba escondida: não pergunta, só marca a próxima.
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const poll = async () => {
      if (!alive) return;
      if (document.hidden) {
        timer = window.setTimeout(poll, POLL_MS);
        return;
      }
      try {
        const next: OrderView = await fetchOrder(orderId, token);
        if (!alive) return;
        setOrder(next);
        setOffline(false);
        const step = afterPoll({ order: next });
        doneRef.current(orderId, trackOf(next, null, false).status.done);
        if (step === "stop") return;
      } catch (error) {
        if (!alive) return;
        const failedWith = error instanceof HttpError ? error.status : null;
        if (afterPoll({ failedWith }) === "gone") {
          goneRef.current();
          return;
        }
        setOffline(true);
      }
      timer = window.setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [orderId, token]);

  const track = order ? trackOf(order, tableNumber, offline) : null;
  const pix = usePix(orderId, token, track?.payment.kind === "pix");
  const rating = useRating(companyId, orderId, allIds, onRated);

  if (!track) return <TrackWaiting text={offline ? OFFLINE_FIRST_TEXT : LOADING_TEXT} />;

  const showRating = track.status.done && (rateHere || rating.sentBefore);
  return (
    <TrackSlip
      track={track}
      pix={pix.view}
      pixFieldRef={pix.field}
      onCopy={() => void pix.copy()}
      onPixRetry={pix.retry}
      rating={showRating ? rating.view : null}
      maxComment={COMMENT_MAX}
      onFood={rating.setFood}
      onService={rating.setService}
      onComment={rating.setComment}
      onSendRating={() => void rating.send()}
      onDismiss={onGone}
    />
  );
}

/** O código Pix do pedido: busca uma vez quando o Pix está a pagar; 404 quer dizer "sem Pix neste restaurante". */
function usePix(orderId: string, token: string, due: boolean) {
  const [state, setState] = useState<Pix["state"]>("loading");
  const [code, setCode] = useState<Awaited<ReturnType<typeof fetchOrderPix>> | null>(null);
  const [copied, setCopied] = useState<Pix["copied"]>("");
  const [attempt, setAttempt] = useState(0);
  const field = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!due) return;
    let alive = true;
    setState("loading");
    fetchOrderPix(orderId, token)
      .then((found) => {
        if (!alive) return;
        setCode(found);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (alive) setState(pixStateOfError(error instanceof HttpError ? error.status : null));
      });
    return () => {
      alive = false;
    };
  }, [orderId, token, due, attempt]);

  return {
    view: pixOf(state, code, copied),
    field,
    retry: () => setAttempt((n) => n + 1),
    copy: async () => {
      if (!code) return;
      setCopied(copiedOutcome(await copyText(code.payload, field.current)));
    },
  };
}

/** A avaliação de "Como foi?": uma por visita; depois de enviar, vale para todos os pedidos de agora. */
function useRating(companyId: string, orderId: string, allIds: string[], onRated: () => void) {
  const sentBefore = orderMemory.feedbackSent(orderId);
  const [sent, setSent] = useState(sentBefore);
  const [food, setFood] = useState("");
  const [service, setService] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  return {
    sentBefore,
    view: ratingOf({ sent, food, service, comment, busy, error }),
    setFood: (id: string) => setFood(id),
    setService: (id: string) => setService(id),
    setComment,
    send: async () => {
      if (!food || !service || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        // A tabela de opiniões também guarda a nota da entrega; pedido de mesa e retirada não têm.
        await createFeedback(companyId, food, service, "não se aplica", comment.trim());
        for (const id of new Set([orderId, ...allIds])) orderMemory.markFeedbackSent(id);
        setSent(true);
        onRated();
      } catch {
        setError(RATING_ERROR);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
  };
}
