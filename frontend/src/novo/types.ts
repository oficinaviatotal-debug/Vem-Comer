/** Formas dos dados que as telas novas recebem por props. Quem liga ao servidor monta estes objetos. */

/** O que o botão do prato faz: `add` põe um na sacola com um toque; `choose` abre as escolhas (tamanho, extras); `none` não faz nada. */
export type DishAction = "add" | "choose" | "none";

export type Dish = {
  id: string;
  name: string;
  description?: string;
  price: number;
  /** O preço muda conforme as escolhas (tamanho, extras): a tela escreve "a partir de". */
  priceFrom?: boolean;
  photo?: string;
  /** Só a página de conferência usa (um emoji no lugar da foto). Com dados de verdade vem vazio. */
  art?: string;
  action: DishAction;
  /** Com `action: "none"`: a frase do porquê ("Esgotado", "Sem pedidos agora", "Indisponível agora"). */
  stateText?: string;
  /** Quantos já estão na sacola, somando todas as linhas do prato. */
  quantity: number;
};

/** Dentro da categoria, um subtítulo ("Tradicionais" em "Pizzas"). Sem subtítulo, `title` é vazio. */
export type DishSection = { title: string; dishes: Dish[] };

export type DishGroup = { key: string; title: string; sections: DishSection[] };

/** `photo` é a foto do primeiro prato da categoria; sem foto, a tela mostra `art` (só na conferência) ou um garfo. */
export type Category = { id: string; label: string; photo?: string; art?: string; on?: boolean };

export type Promo = { title: string; price: number; note: string; art: string };

/** A casa do restaurante: `logo` é a logomarca de verdade; `mark` é um emoji só da conferência. */
export type Shop = { name: string; logo?: string; mark?: string; sub?: string };

/** Uma informação em pílula ("Aberto até 23h"): verde quando está aberto, vermelha quando está fechado. */
export type Fact = { text: string; tone: "open" | "closed" };

export type Cart = { items: number; total: number };

export type TodoItem = {
  id: string;
  kind: "call" | "pix";
  title: string;
  note: string;
  action: string;
  /** A tela onde esse assunto aparece inteiro; o toque no texto leva até ela. Sem tela, o texto só informa. */
  view?: string | null;
};

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
  /**
   * Para onde levam os toques da tela (botão dos pedidos, números, as três caixas de cima). Quem monta os dados diz os
   * nomes das telas; a tela não os conhece. `null`: esta pessoa não tem essa tela, então a caixa só informa.
   */
  views: { orders: string; numbers: string; deliveries: string | null; tables: string | null };
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

/** Uma opção dentro de um grupo ("300 ml", "Bacon"). `blocked`: o grupo já está cheio e esta opção não está marcada. */
export type ChoiceItem = { id: string; name: string; priceText: string; on: boolean; blocked: boolean };

export type ChoiceGroup = {
  id: string;
  name: string;
  /** A regra em poucas palavras ("Escolha 1", "Opcional, até 5"). */
  rule: string;
  required: boolean;
  /** Escolha única: tocar numa opção troca a anterior. Senão, liga e desliga até o máximo. */
  single: boolean;
  items: ChoiceItem[];
  /** O que falta neste grupo, só depois de a pessoa tentar confirmar. */
  problem: string | null;
  emptyText?: string;
};

/** A folha de escolhas de um prato: o que escolher, a observação, a quantidade e o total. */
export type Choices = {
  title: string;
  description?: string;
  photo?: string;
  /** Só a página de conferência usa (um emoji no lugar da foto). */
  art?: string;
  groups: ChoiceGroup[];
  note: { value: string; count: number; max: number; problem: string | null };
  quantity: number;
  canLess: boolean;
  canMore: boolean;
  total: number;
  /** "Adicionar" ou, ao mudar uma linha que já está na sacola, "Salvar". */
  confirmLabel: string;
};

/** Uma opção de um conjunto em que só uma vale (como receber, como pagar). */
export type Option = { id: string; label: string; on: boolean };

/** Uma linha da comanda: o prato, o que o cliente escolheu nele, a observação, a quantidade e o total da linha. */
export type BagLine = {
  key: string;
  name: string;
  /** "Grande, Bacon": o que o cliente escolheu no prato. */
  detail?: string;
  note?: string;
  quantity: number;
  total: number;
  /** Tem escolhas e o prato ainda está no cardápio: "Mudar opções" aparece. */
  canEdit: boolean;
};

/** A resposta do servidor sobre o CEP, em uma frase. `fail`: a resposta não chegou (sem internet). */
export type QuoteLine = { text: string; tone: "ok" | "no" | "wait" | "fail" };

/** O endereço de entrega, já com máscara de CEP e de telefone. */
export type BagDelivery = {
  cep: string;
  quote: QuoteLine | null;
  /** Antes de o CEP ter 8 números: o que fazer. */
  hint?: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  reference: string;
  phone: string;
  /** O endereço da tela veio da memória deste aparelho: aparece "Esquecer meu endereço". */
  remembered: boolean;
};

/** A sacola de verdade: a comanda com o total, como receber, o nome, o endereço, o pagamento. */
export type Bag = {
  /** "Mesa 4", "Entrega", "Retirada" ou "Pedido". */
  where: string;
  lines: BagLine[];
  emptyText: string;
  subtotal: number;
  /** A taxa que o servidor anunciou para o CEP; null: sem taxa para mostrar. */
  fee: number | null;
  total: number;
  notices: string[];
  /** Só tem itens quando o restaurante oferece mais de uma forma de receber. */
  modes: Option[];
  pausedNote: string | null;
  nameLabel: string;
  name: string;
  delivery: BagDelivery | null;
  payments: Option[];
  /** Só no dinheiro: com quanto a pessoa vai pagar, e o valor certinho para o botão "Tenho o valor certinho". */
  cash: { value: string; exact: string } | null;
  paymentNote: string;
};
