import { useEffect, useRef } from "react";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

type Options = {
  /** O que contém o diálogo (para o Tab não sair dele). */
  root?: string;
  /** O título do diálogo, que recebe o foco ao abrir. */
  focusId?: string;
};

/**
 * O que uma folha ou um menu aberto precisa para ser de verdade um diálogo: a tela de trás não rola, o Esc fecha, o foco
 * entra no diálogo e volta para onde estava, e o Tab não sai dele. Serve à folha das escolhas e ao menu geral.
 */
export function useSheetBehavior(onClose: () => void, { root = ".nv-sheet", focusId = "nv-sheet-title" }: Options = {}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById(focusId)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(root);
      if (!dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [root, focusId]);
}
