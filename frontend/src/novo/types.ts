/** Formas dos dados que as telas novas recebem por props. Quem liga ao servidor monta estes objetos. */

export type Dish = { id: string; name: string; price: number; photo?: string; art?: string };

export type Category = { id: string; label: string; art: string; on?: boolean };

export type Promo = { title: string; price: number; note: string; art: string };

export type Shop = { name: string; mark: string; city: string; openUntil: string; eta: string; fee: number };

export type Cart = { items: number; total: number };

export type TodoItem = { id: string; kind: "call" | "pix"; title: string; note: string; action: string };

/** As vendas do dia. `hours` vai da primeira hora mostrada até a hora de agora; `nowIndex` é a barra de agora (-1: sem barras). */
export type Sales = {
  total: number;
  orders: number;
  /** Sem pedido ainda, o servidor não tem ticket médio: nunca se inventa um. */
  averageTicket: number | null;
  hours: number[];
  hoursFrom: number;
  nowIndex: number;
};

export type Shortcut = { view: string; label: string };

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
  /** null: as vendas ainda não chegaram, ou quem olha não vê vendas. */
  sales: Sales | null;
  /** Frase no lugar das vendas quando não há número ("Carregando…", "Não consegui abrir as vendas agora."). */
  salesMessage?: string;
  shortcuts: Shortcut[];
  /** Para onde levam os dois botões fixos da tela. Quem monta os dados diz os nomes das telas; a tela não os conhece. */
  views: { orders: string; numbers: string };
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
