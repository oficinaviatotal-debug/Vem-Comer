/** Shapes the customer screens share. They mirror what the API returns. */

import type { OptionGroup } from "./options";

export type Company = {
  id: string;
  name: string;
  slug: string;
  /** Paths like "/media/<company>/<key>.webp"; null when the restaurant has no logo. Use mediaUrl() to show them. */
  logo_url?: string | null;
  logo_thumb_url?: string | null;
  /**
   * False when the restaurant cannot take new orders right now (its plan is blocked). The customer is never told
   * why. An older server does not send it: only an explicit false closes the menu.
   */
  accepting_orders?: boolean;
  /**
   * Opening hours and the owner's pause, as the server sees them right now. `configured` is false for a restaurant
   * with no hours (always open). Only the sentence is sent, never the shifts. An older server does not send it.
   */
  hours?: {
    configured: boolean;
    open_now: boolean;
    message: string;
    paused: boolean;
  };
};

export type Product = {
  id: string;
  company_id?: string;
  menu_id: string | null;
  name: string;
  description?: string | null;
  price: number | string;
  /** Paths like "/media/<company>/<key>.webp"; null when the dish has no photo. Use mediaUrl() to show them. */
  image_url?: string | null;
  thumb_url?: string | null;
  /** Size, extras and the like the customer chooses before ordering; missing or empty for a plain dish. */
  option_groups?: OptionGroup[];
  /** The dish ran out today: it stays on the menu, marked, and cannot be ordered. */
  sold_out?: boolean;
};

export type Menu = {
  id: string;
  name: string;
  active?: boolean;
};

/** What the server copied into the order when the customer chose (name and price of that moment). */
export type OrderItemOption = {
  group?: string;
  name: string;
  price?: number | string;
};

export type OrderItem = {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price?: number | string;
  total: number | string;
  options?: OrderItemOption[] | null;
  note?: string | null;
};

/** What GET /api/orders/<id> returns for the customer's own order. */
export type OrderView = {
  id: string;
  customer_name: string;
  total_price: number | string;
  status: string;
  items: OrderItem[];
  /** "pix", "cartao" or "dinheiro". */
  payment_method?: string;
  /** "PENDING" until the restaurant confirms the money arrived, then "PAID". */
  payment_status?: string;
  /** "mesa", "retirada", "entrega" or "balcao" (an order from before delivery existed is "balcao"). */
  order_type?: string;
  /** What the server added to the total for delivery; the total above already has it. */
  delivery_fee?: number | string | null;
  delivery_zone?: string | null;
  delivery_address?: Record<string, unknown> | null;
  customer_phone?: string | null;
};

export type PaymentMethod = "pix" | "cartao" | "dinheiro";
