/**
 * Remembers, on this phone only, the orders the customer sent in this
 * restaurant so that closing the browser or reloading the page does not lose
 * the tracking. People often order twice (another round of drinks), so it
 * keeps a short list, newest first. Storage can be blocked (private mode), so
 * every access is guarded and the app works without it.
 */

export type RememberedOrder = {
  orderId: string;
  token: string;
  slug: string;
  tableId: string | null;
  savedAt: number;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** A meal is over long before this; the server link itself lasts 7 days. */
export const ORDER_TTL_MS = 12 * 60 * 60 * 1000;
export const MAX_REMEMBERED = 6;

const ordersKey = (slug: string) => `vc_orders_${slug}`;
const feedbackKey = (orderId: string) => `vc_feedback_${orderId}`;
const NAME_KEY = "vc_customer_name";

function isRemembered(value: unknown): value is RememberedOrder {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.orderId === "string" &&
    typeof item.token === "string" &&
    typeof item.slug === "string" &&
    typeof item.savedAt === "number" &&
    (item.tableId === null || typeof item.tableId === "string")
  );
}

export function createOrderMemory(storage: StorageLike | null, now: () => number = Date.now) {
  const read = (key: string): string | null => {
    try {
      return storage ? storage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try {
      storage?.setItem(key, value);
    } catch {
      /* storage unavailable: the order simply is not remembered */
    }
  };
  const drop = (key: string) => {
    try {
      storage?.removeItem(key);
    } catch {
      /* nothing to do */
    }
  };

  /** Everything stored for the restaurant that is valid and recent, newest first. */
  const stored = (slug: string): RememberedOrder[] => {
    const raw = read(ordersKey(slug));
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(isRemembered)
        .filter((item) => item.slug === slug && now() - item.savedAt <= ORDER_TTL_MS)
        .slice(0, MAX_REMEMBERED);
    } catch {
      return [];
    }
  };

  const persist = (slug: string, orders: RememberedOrder[]) => {
    if (orders.length) write(ordersKey(slug), JSON.stringify(orders));
    else drop(ordersKey(slug));
  };

  return {
    /**
     * The orders to keep tracking in this restaurant, newest first. Orders
     * from another table are left out: the customer scanned a new QR code.
     */
    list(slug: string, tableId: string | null): RememberedOrder[] {
      return stored(slug).filter(
        (item) => !tableId || !item.tableId || item.tableId === tableId
      );
    },

    /** Adds the order that was just sent and returns the updated list. */
    add(order: Omit<RememberedOrder, "savedAt">): RememberedOrder[] {
      const next = [
        { ...order, savedAt: now() },
        ...stored(order.slug).filter((item) => item.orderId !== order.orderId),
      ].slice(0, MAX_REMEMBERED);
      persist(order.slug, next);
      return next;
    },

    remove(slug: string, orderId: string): RememberedOrder[] {
      const next = stored(slug).filter((item) => item.orderId !== orderId);
      persist(slug, next);
      return next;
    },

    feedbackSent(orderId: string): boolean {
      return read(feedbackKey(orderId)) === "1";
    },

    markFeedbackSent(orderId: string) {
      write(feedbackKey(orderId), "1");
    },

    loadName(): string {
      return read(NAME_KEY) ?? "";
    },

    saveName(name: string) {
      if (name) write(NAME_KEY, name);
      else drop(NAME_KEY);
    },
  };
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const orderMemory = createOrderMemory(browserStorage());
