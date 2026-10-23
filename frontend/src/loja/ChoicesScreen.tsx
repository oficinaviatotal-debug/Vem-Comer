import { useState } from "react";
import ChoicesSheet from "../novo/Choices";
import type { CartLine } from "../customer/cart";
import { groupsOf, selectionFromChosen, type Selection } from "../customer/options";
import type { Product } from "../customer/types";
import { mediaUrl } from "../service/api";
import { useSheetBehavior } from "./useSheetBehavior";
import { choicesViewOf, clampQuantity, confirmChoices, nextQuantity, pressOption, type ChoicesPick } from "./choicesLogic";

type Props = {
  product: Product;
  /** Mudando uma linha que já está na sacola: o que ela tinha. Sem isso, a folha abre em branco. */
  initial?: { selection: Selection; note: string; quantity: number };
  /** Quantas a pessoa já pediu (a voz: "duas pizzas"). A folha abre com esse número; o botão continua dizendo Adicionar. Ignorado em `initial`. */
  quantity?: number;
  onConfirm: (pick: ChoicesPick) => void;
  onClose: () => void;
};

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
export default function ChoicesScreen({ product, initial, quantity: asked, onConfirm, onClose }: Props) {
  const [selection, setSelection] = useState<Selection>(initial?.selection ?? {});
  const [note, setNote] = useState(initial?.note ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? clampQuantity(asked ?? 1));
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
