import type { OrderItemOption } from "./types";

type Props = {
  options?: OrderItemOption[] | null;
  note?: string | null;
};

/**
 * What the customer chose on a dish (size, extras) and what they wrote ("sem cebola"), under the dish name.
 * Used by the customer's tracking screen and by the owner panel, so the kitchen reads exactly the same words.
 */
export default function ItemDetails({ options, note }: Props) {
  const names = (options ?? []).map((option) => option.name).filter(Boolean);
  const text = (note ?? "").trim();
  if (names.length === 0 && !text) return null;
  return (
    <div className="comanda-extra">
      {names.length > 0 && <p className="comanda-opts">{names.join(", ")}</p>}
      {text && (
        <p className="comanda-note">
          <span>Obs.:</span> {text}
        </p>
      )}
    </div>
  );
}
