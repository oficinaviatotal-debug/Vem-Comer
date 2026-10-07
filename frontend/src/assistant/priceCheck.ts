/**
 * A price that looks like a hearing mistake. The phone's recognizer writes "três reais" right, but a
 * "3,00" can come out as "300", and R$ 300,00 on a canned soda would go to the customers. The assistant
 * never changes a price by itself: it points the dish out ("Confira") and says what it might have been.
 */

import { guessCategory } from "./spokenMenu.ts";

/** Highest price, in reais, that a dish of this category normally has. Above it the assistant asks. */
const CEILING: Record<string, number> = {
  Bebidas: 80,
  Sucos: 60,
  Cervejas: 80,
  "Cafés": 60,
  Salgados: 60,
  Sobremesas: 100,
  Lanches: 120,
  "Porções": 180,
  "Açaí": 120,
  Espetinhos: 100,
  Marmitas: 120,
};

/** Pratos, Pizzas, Japonês and Combos: a family combo or a big platter can be expensive. */
const DEFAULT_CEILING = 400;

export type PriceDoubt = {
  /** "3.00" when the price looks like that with the comma lost ("300"), otherwise null. */
  maybe: string | null;
};

/** Null when the price is believable for this dish. */
export function priceDoubt(dishName: string, price: string): PriceDoubt | null {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return null;
  const ceiling = CEILING[guessCategory(dishName)] ?? DEFAULT_CEILING;
  if (value <= ceiling) return null;
  const hundreds = value / 100;
  const lostComma = Number.isInteger(hundreds) && hundreds >= 1 && hundreds <= ceiling;
  return { maybe: lostComma ? hundreds.toFixed(2) : null };
}
