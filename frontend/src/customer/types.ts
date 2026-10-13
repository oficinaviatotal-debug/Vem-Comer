/** Shapes the customer screens share. They mirror what the API returns. */

import type { OptionGroup } from "./options";

export type Company = {
  id: string;
  name: string;
  slug: string;
  /** Paths like "/media/<company>/<key>.webp"; null when the restaurant has no logo. Use mediaUrl() to show them. */
  logo_url?: string | null;
  logo_thumb_url?: string | null;
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
