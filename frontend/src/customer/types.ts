/** Shapes the customer screens share. They mirror what the API returns. */

export type Company = {
  id: string;
  name: string;
  slug: string;
};

export type Product = {
  id: string;
  company_id?: string;
  menu_id: string | null;
  name: string;
  description?: string | null;
  price: number | string;
};

export type Menu = {
  id: string;
  name: string;
  active?: boolean;
};

export type OrderItem = {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price?: number | string;
  total: number | string;
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
};

export type PaymentMethod = "pix" | "cartao" | "dinheiro";
