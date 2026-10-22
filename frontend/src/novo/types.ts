/** Formas dos dados que as telas novas recebem por props. Quem liga ao servidor monta estes objetos. */

export type Dish = { id: string; name: string; price: number; photo?: string; art?: string };

export type Category = { id: string; label: string; art: string; on?: boolean };

export type Promo = { title: string; price: number; note: string; art: string };

export type Shop = { name: string; mark: string; city: string; openUntil: string; eta: string; fee: number };

export type Cart = { items: number; total: number };

export type TodoItem = { id: string; kind: "call" | "pix"; title: string; note: string; action: string };

export type Today = {
  /** A saudação já pronta ("Bom dia, João"): quem monta os dados escolhe pelo horário. */
  greeting: string;
  dateLine: string;
  waiting: number;
  oldestMinutes: number;
  cooking: number;
  onTheWay: number;
  calling: number;
  todo: TodoItem[];
  salesTotal: number;
  salesOrders: number;
  averageTicket: number;
  /** Pedidos por hora, da primeira hora mostrada até agora. */
  hours: number[];
  hoursFrom: number;
  nowIndex: number;
};

export type Ticket = {
  id: string;
  number: string;
  where: string;
  minutes: number;
  lines: { qty: number; name: string; detail?: string }[];
  note?: string;
  action: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  city: string;
  mode: string;
  contract: string;
  ago: string;
};

export type Tab = { id: string; label: string; count: number };
