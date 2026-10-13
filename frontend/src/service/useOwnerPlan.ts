import { useCallback, useEffect, useState } from "react";
import { fetchOwnerPlan } from "./subscriptionApi";
import type { OwnerPlan } from "./subscriptionView";

/** How often the panel asks again: a payment registered by GD must unlock the restaurant without a new login. */
export const PLAN_REFRESH_MS = 60_000;

/**
 * The plan of the restaurant of the login, kept fresh while the panel is open. A failure to read it NEVER blocks
 * anything: with no answer there is no plan, and the panel works as it always did.
 */
export function useOwnerPlan(enabled: boolean): { plan: OwnerPlan | null; reload: () => void } {
  const [plan, setPlan] = useState<OwnerPlan | null>(null);

  const reload = useCallback(() => {
    if (!enabled) return;
    fetchOwnerPlan()
      .then((next) => setPlan(next))
      .catch(() => {
        /* keep what we had */
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setPlan(null);
      return;
    }
    reload();
    const timer = window.setInterval(reload, PLAN_REFRESH_MS);
    function onVisible() {
      if (document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, reload]);

  return { plan, reload };
}
