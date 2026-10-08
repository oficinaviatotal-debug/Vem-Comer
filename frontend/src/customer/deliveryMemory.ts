/**
 * Remembers, on this phone only, the address and phone the customer typed for a delivery, so ordering again does not
 * mean typing them again. Nothing leaves the phone from here; the customer can erase it with one tap. Storage can be
 * blocked (private mode), so every access is guarded and the app works without it.
 */

import { EMPTY_ADDRESS, type Address } from "./delivery.ts";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type RememberedDelivery = { address: Address; phone: string };

const keyOf = (slug: string) => `vc_delivery_${slug}`;
const FIELDS = Object.keys(EMPTY_ADDRESS) as (keyof Address)[];

function parse(raw: string | null): RememberedDelivery | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const item = value as { address?: unknown; phone?: unknown };
    if (!item.address || typeof item.address !== "object") return null;
    const source = item.address as Record<string, unknown>;
    const address = { ...EMPTY_ADDRESS };
    for (const field of FIELDS) {
      if (typeof source[field] === "string") address[field] = (source[field] as string).slice(0, 200);
    }
    return { address, phone: typeof item.phone === "string" ? item.phone.slice(0, 20) : "" };
  } catch {
    return null;
  }
}

export function createDeliveryMemory(storage: StorageLike | null) {
  return {
    load(slug: string): RememberedDelivery | null {
      try {
        return storage ? parse(storage.getItem(keyOf(slug))) : null;
      } catch {
        return null;
      }
    },
    save(slug: string, value: RememberedDelivery): void {
      try {
        storage?.setItem(keyOf(slug), JSON.stringify(value));
      } catch {
        /* storage unavailable: the address is simply not remembered */
      }
    },
    forget(slug: string): void {
      try {
        storage?.removeItem(keyOf(slug));
      } catch {
        /* nothing to do */
      }
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

export const deliveryMemory = createDeliveryMemory(browserStorage());
