import { useEffect, useRef, useState } from "react";
import ChoicesSheet from "../novo/Choices";
import type { CartLine } from "../customer/cart";
import { groupsOf, selectionFromChosen, type Selection } from "../customer/options";
import type { Product } from "../customer/types";
import { mediaUrl } from "../service/api";
import { choicesViewOf, confirmChoices, nextQuantity, pressOption, type ChoicesPick } from "./choicesLogic";

type Props = {
  product: Product;
  /** Mudando uma linha que já está na sacola: o que ela tinha. Sem isso, a folha abre em branco. */
  initial?: { selection: Selection; note: string; quantity: number };
  onConfirm: (pick: ChoicesPick) => void;
  onClose: () => void;
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * O que uma folha aberta precisa para ser de verdade um diálogo: a tela de trás não rola, o Esc fecha, o foco entra
 * na folha e volta para onde estava, e o Tab não sai dela.
 */
function useSheetBehavior(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById("nv-sheet-title")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const sheet = document.querySelector<HTMLElement>(".nv-sheet");
      if (!sheet) return;
      const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
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
  }, []);
}

/** Rola até o que falta (ou foca a observação) para a pessoa ver o aviso em vermelho. */
function showProblem(groupId: string | null) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  if (groupId) {
    document.getElementById(`nv-opt-group-${groupId}`)?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  } else {
    document.querySelector<HTMLInputElement>(".nv-sheet .nv-text input")?.focus();
  }
}

/** A folha das escolhas de um prato: guarda o que a pessoa marcou e só deixa adicionar quando está completo. */
export default function ChoicesScreen({ product, initial, onConfirm, onClose }: Props) {
  const [selection, setSelection] = useState<Selection>(initial?.selection ?? {});
  const [note, setNote] = useState(initial?.note ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [tried, setTried] = useState(false);
  useSheetBehavior(onClose);

  const choices = choicesViewOf({ product, selection, note, quantity, tried, editing: Boolean(initial), media: mediaUrl });

  return (
    <ChoicesSheet
      choices={choices}
      onPress={(groupId, itemId) => setSelection((current) => pressOption(current, product, groupId, itemId))}
      onNote={setNote}
      onMore={() => setQuantity((current) => nextQuantity(current, 1))}
      onLess={() => setQuantity((current) => nextQuantity(current, -1))}
      onConfirm={() => {
        const result = confirmChoices({ product, selection, note, quantity });
        if (result.ok) {
          onConfirm(result.pick);
          return;
        }
        setTried(true);
        // O aviso só aparece depois deste render; um instante depois a tela já o tem.
        window.setTimeout(() => showProblem(result.groupId), 0);
      }}
      onClose={onClose}
    />
  );
}

/** As escolhas que uma linha da sacola já tem, no formato da folha. */
export function initialOf(product: Product, line: Pick<CartLine, "options" | "note" | "quantity">) {
  return {
    selection: selectionFromChosen(groupsOf(product), line.options ?? []),
    note: line.note ?? "",
    quantity: line.quantity,
  };
}
