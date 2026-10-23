import type { NvIconName } from "./Icons";
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

/**
 * "O que falta" no Hoje do dono: um passo que o sistema sabe, pelos dados de verdade, que ainda não foi dado. Diz o que está faltando (`title`),
 * como resolver (`note`) e leva à tela certa (`view`). Nada entra aqui por palpite.
 */
export type GuideItem = {
  id: "menu" | "pix" | "tables" | "photos";
  title: string;
  note: string;
  action: string;
  view: string;
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
  /** O que falta montar no restaurante (só para dono e gerente, só o que o servidor confirmou). Vazio: nada a dizer. */
  guide?: GuideItem[];
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

/** Uma etapa do andamento do pedido ("Enviado", "Em preparo", "Pronto"). */
export type TrackStep = { label: string; state: "done" | "current" | "todo" };

export type TrackStatus = {
  headline: string;
  hint: string;
  steps: TrackStep[];
  /** Nada mais a esperar: pronto, ou entregue. */
  done: boolean;
};

export type TrackLine = { key: string; quantity: number; name: string; detail?: string; note?: string; total: number };

/** O que a comanda diz do pagamento: já pago, a pagar com Pix (o código vem de outra busca), ou a acertar na hora. */
export type TrackPayment = { kind: "paid"; title: string; text: string } | { kind: "pix" } | { kind: "later"; text: string };

/** O pedido que o cliente enviou, como o servidor o conhece agora. */
export type Track = {
  /** "#A1B2": as quatro primeiras letras do pedido. */
  code: string;
  /** "Mesa 4", "Entrega", "Retirada" ou "Pedido". */
  where: string;
  customerName?: string;
  /** Para onde vai (entrega) ou o que fazer (retirada); null nos outros pedidos. `phone`: o telefone, já com máscara. */
  handling: { title: string; text: string; phone?: string } | null;
  status: TrackStatus;
  /** Os 4 números que o cliente passa ao entregador na porta. Só numa entrega aberta. */
  deliveryCode: { title: string; digits: string[]; spoken: string; hint: string } | null;
  lines: TrackLine[];
  /** A taxa que o servidor somou (0 = grátis); null quando o pedido não é entrega. */
  fee: number | null;
  total: number;
  payment: TrackPayment;
  /** A última busca falhou: o que aparece é o último andamento que chegou. */
  offline: boolean;
};

/** O Pix a pagar: o estado da busca do código e o que mostrar. */
export type Pix = {
  state: "loading" | "ready" | "missing" | "error";
  amount?: number;
  receiver?: string;
  /** O Pix Copia e Cola. */
  payload?: string;
  /** A imagem do QR, já pronta (data:). */
  qr?: string;
  copied: "" | "ok" | "manual";
};

/** A avaliação de "Como foi?": comida e atendimento, mais um comentário. */
export type Rating = {
  sent: boolean;
  food: Option[];
  service: Option[];
  comment: string;
  canSend: boolean;
  busy: boolean;
  error: string | null;
};

/** O que a mesa pode pedir. Os mesmos quatro do servidor; a tela escolhe o desenho de cada um. */
export type CallKind = "garcom" | "conta" | "agua" | "limpeza";

/**
 * Um botão da mesa. `state`: pronto para tocar, mandando, já chamado (espere), atendido (pode chamar de novo) ou
 * "ainda não veio?" (passou um minuto sem resposta: pode avisar de novo). `locked`: o toque agora não faz nada
 * (mandando ou recém-chamado). `spoken` é a frase inteira para o leitor de tela, que não vê as cores.
 */
export type CallTile = {
  kind: CallKind;
  title: string;
  /** "Chamado", "Atendido"...; vazio quando o botão está pronto. */
  status: string;
  note: string;
  state: "ready" | "busy" | "called" | "answered" | "again";
  locked: boolean;
  spoken: string;
};

/** A tela da mesa: o que abre quando o cliente lê o QR. */
export type TableView = {
  /** "Mesa 4", ou "Sua mesa" enquanto o número não chegou. */
  title: string;
  sub: string;
  main: CallTile[];
  small: CallTile[];
  /** A frase que confirma o toque ("Avisamos o atendente."); vazio quando não há. Lida em voz alta. */
  notice: string;
  /** Quando o aviso não saiu: o que fazer. Vazio quando não há. */
  error: string;
  /** Quantos pedidos este aparelho já enviou; com pelo menos um, aparece "Acompanhar o seu pedido". */
  ordersCount: number;
  /** Só endereço https de verdade; senão null e o botão some. */
  jobsHref: string | null;
};

/** Uma linha do menu geral: para onde leva, como se chama, uma frase do que faz e o número pequeno (pedidos em aberto). */
export type MenuItem = {
  view: string;
  label: string;
  hint: string;
  icon: NvIconName;
  /** O número ao lado do nome; null quando não há. */
  badge: number | null;
  /** A tela em que a pessoa está agora: marcada e anunciada ("página atual"). */
  current: boolean;
  /** Frase do número para o leitor de tela ("3 em aberto"). */
  badgeSpoken: string;
};

export type MenuGroup = { key: string; title: string | null; items: MenuItem[] };

/** O que não é tela: ver o cardápio do cliente, pedir ajuda, sair. `quiet`: a linha discreta do fim (Sair). */
export type MenuAction = { id: string; label: string; icon: NvIconName; quiet?: boolean };

export type MenuView = {
  /** O restaurante e, embaixo, quem está dentro ("Maria, Gerente"). */
  place: string;
  person: string;
  groups: MenuGroup[];
  actions: MenuAction[];
};

/** Uma mesa chamando, como o garçom lê: a mesa, o que ela quer, há quanto tempo e a cor da espera. */
export type DeskCall = {
  id: string;
  kind: CallKind;
  /** "Mesa 4". */
  where: string;
  /** "Chama o garçom". */
  what: string;
  /** "há 2 min". */
  wait: string;
  /** O cliente tocou de novo. */
  again: boolean;
  /** A cor da fita pelo que o servidor diz da espera: ok (verde), warn (amarela), late (vermelha). */
  tone: "ok" | "warn" | "late";
  /** A mesma espera em palavra, para quem não vê cor: "", "Está demorando", "Urgente". */
  word: string;
  /** A mesa no cadastro, para abrir ao tocar; null enquanto a lista de mesas não chegou. */
  tableId: string | null;
  /** O botão "Já atendi" lido por inteiro (o leitor de tela repete o botão em cada cartão). */
  spoken: string;
};

/** Uma mesa da lista: o número e o que existe agora (chamando, pedidos, nada). */
export type DeskTile = {
  id: string;
  number: number;
  note: string;
  tone: "call" | "busy" | "quiet";
  spoken: string;
};

/** O que a tela de mesas mostra na lista. `tiles: null` enquanto a lista de mesas não chegou. */
export type DeskView = {
  sub: string;
  calls: DeskCall[];
  tiles: DeskTile[] | null;
  /** A frase no lugar da lista: abrindo, sem mesas, ou o erro. Vazia quando há mesas. */
  tilesMessage: string;
  tilesFailed: boolean;
  /** Resposta ao número digitado ou ao QR lido ("Não achei essa mesa..."). */
  message: string;
  /** Frase de erro ao marcar como atendida. */
  error: string;
};

/** Um pedido andando na mesa aberta. */
export type DeskOrder = {
  id: string;
  name: string;
  status: string;
  tone: "wait" | "prep" | "go" | "done";
  wait: string;
  price: string;
};

/** A mesa aberta: título, a frase do que existe, os chamados e os pedidos em andamento. */
export type DeskTableView = {
  title: string;
  headline: string;
  calls: DeskCall[];
  orders: DeskOrder[];
  /** O cardápio desta mesa (para o garçom pedir pelo cliente); null: sem endereço válido, o botão não aparece. */
  orderHref: string | null;
  error: string;
};

// ---------------------------------------------------------------- Pedidos e caixa (painel)

/** Um pedido no painel: o que o caixa e o salão leem e tocam. Tudo já vem em frase pronta. */
export type OrderCard = {
  id: string;
  /** "#A1B2": o código curto que dá para falar em voz alta. */
  number: string;
  /** "Mesa 5", "Entrega", "Retirada" ou "Balcão". */
  where: string;
  kind: "mesa" | "entrega" | "retirada" | "balcao";
  /** Nome de quem pediu; vazio quando não há. */
  who: string;
  /** "12:35". */
  time: string;
  minutes: number;
  /** A cor da fita pelo tempo de espera; pedido encerrado fica sempre "ok". */
  wait: "ok" | "warn" | "late";
  /** A etapa em palavra ("Aguardando", "Em preparo", "A caminho", "Entregue"). */
  status: string;
  tone: "wait" | "prep" | "go" | "done";
  /** Entrega e retirada: para onde vai, quem leva e como ligar. Null nos outros pedidos. */
  ship: { main: string; sub: string[]; phone: string; phoneHref: string; courier: string } | null;
  lines: { qty: number; name: string; detail?: string }[];
  note?: string;
  total: string;
  /** "Itens R$ 42,00 + entrega R$ 6,00"; vazio quando não há taxa. */
  split: string;
  pay: { chip: string; chipTone: "ok" | "wait" | "info"; extra: string };
  /** O texto do botão "Pagamento recebido"; vazio quando esta pessoa não confirma pagamento ou já está pago. */
  receive: string;
  /** O botão grande que avança o pedido e o atalho pequeno; vazios quando não há mais o que fazer. */
  action: string;
  skip: string;
  /** O que o leitor de tela fala em cada botão, com a mesa e o código para não haver dois botões iguais. */
  receiveSpoken: string;
  actionSpoken: string;
  skipSpoken: string;
};

export type OrdersView = {
  sub: string;
  tabs: Tab[];
  active: string;
  cards: OrderCard[];
  empty: string;
  error: string;
};

/** Uma entrega na tela do entregador (e do gerente): para onde vai, quanto receber na porta e o botão do momento. */
export type DeliveryCard = {
  id: string;
  /** "#A1B2": o código curto que dá para falar em voz alta. */
  number: string;
  who: string;
  /** O endereço em letra grande; "Endereço não informado" quando não há. */
  address: string;
  /** Região e referência, uma linha cada. */
  sub: string[];
  stage: "ready" | "going" | "other" | "done";
  /** Dinheiro a receber na porta: o valor e o troco a levar. Null quando nada se recebe em dinheiro. */
  cash: { main: string; sub: string } | null;
  phoneHref: string;
  mapHref: string;
  /** O botão grande do momento ("Peguei", "Entreguei"); vazio quando não há o que fazer (com outro, entregue). */
  action: string;
  actionSpoken: string;
  /** O pedido pede os 4 números do cliente para fechar. */
  needsCode: boolean;
  /** Entregue: a hora. */
  time: string;
  /** Entregue com dinheiro: de quem ele está agora. */
  money: { text: string; tone: "owe" | "settled" } | null;
};

export type DeliveriesView = {
  sub: string;
  /** "Você está com R$ 62,50 em dinheiro…": o que ele ainda deve ao caixa. Vazio quando não deve nada. */
  held: string;
  tabs: Tab[];
  active: string;
  cards: DeliveryCard[];
  empty: string;
  error: string;
  notice: string;
};

/** Uma entrega dentro do acerto: quem, onde, quando e quanto, e se está marcada. */
export type SettleRow = { id: string; label: string; amount: string; checked: boolean };

export type SettleGroup = {
  id: string;
  name: string;
  /** O total que o motoqueiro deve (todas as entregas dele). */
  total: string;
  rows: SettleRow[];
  /** A soma do que está marcado. */
  marked: string;
  count: number;
  /** "Recebi R$ 62,50 de Ana (2 entregas)"; vazio quando nada está marcado. */
  button: string;
  /** Depois do primeiro toque, até o segundo (ou até passar o tempo). */
  armed: boolean;
};

export type SettleView = {
  sub: string;
  /** O que o leitor de tela fala quando algo muda (a frase de cima, ou o pedido de confirmar). */
  live: string;
  total: string;
  groups: SettleGroup[];
  empty: string;
  error: string;
  notice: string;
};

// ---------------------------------------------------------------- Cardápio: montar

/** Um jeito de começar: tocável quando `state` é "ready"; senão só informa, liso, e a frase do `hint` diz o porquê. */
export type MenuDoorCard = {
  id: "photo" | "gallery" | "file" | "speak" | "write" | "model";
  title: string;
  hint: string;
  state: "ready" | "loading" | "off";
  badge: string;
  /** Só na porta do arquivo: o que o seletor aceita (planilha, e PDF quando o servidor lê). */
  accept: string;
};

/** Uma página fotografada: `src` só vale como endereço `blob:` (a foto que está neste aparelho). */
export type MenuPageThumb = { id: number; src: string; label: string };

/** Um prato como aparece na lista de quem está falando. */
/** `inside` é o que vai dentro do prato, como foi dito ou lido ("" quando não há). */
export type MenuHeardDish = { id: string; name: string; price: string; missing: boolean; inside: string };
export type MenuHeardGroup = { id: string; name: string; dishes: MenuHeardDish[] };

/** Um prato na conferência: `price` é a frase ("R$ 25,00"), `priceValue` é o que vai no campo ("25,00"). */
export type MenuReviewDish = {
  id: string;
  name: string;
  /** O nome da categoria onde o prato está. */
  group: string;
  price: string;
  priceValue: string;
  missing: boolean;
  /** O que vai dentro do prato ("Ovo, bacon, salame"), exatamente o que foi dito, escrito ou lido da foto. "" quando não há. */
  inside: string;
  /** Preço que parece engano de escuta ("300" no lugar de "3,00"): a frase e o valor que o toque aplica ("" quando não há palpite). */
  doubt: { text: string; use: string } | null;
};
export type MenuReviewGroup = { id: string; name: string; dishes: MenuReviewDish[] };

/** Um tipo de negócio na grade do modelo: `icon` é o desenho (emoji) que o servidor manda, sempre texto. */
export type MenuModelTile = { id: string; name: string; icon: string };

/** Um prato do modelo na lista de quem marca: tocar marca ou desmarca. */
export type MenuPickDish = { id: string; name: string; selected: boolean };

export type MenuSetupView =
  | { stage: "door"; sub: string; loading: boolean; cards: MenuDoorCard[]; foot: string; error: string }
  | {
      stage: "types";
      sub: string;
      /** Ainda esperando a lista do servidor (ou o modelo escolhido): não diz "não achei" nem mostra tipos. */
      loading: boolean;
      /** O que se faz enquanto espera, escrito ("Abrindo os tipos de negócio…", "Abrindo o modelo…"). */
      working: string;
      error: string;
      /** A busca digitada e os tipos que ela deixou (todos quando está vazia). */
      query: string;
      tiles: MenuModelTile[];
      empty: string;
      /** A lista não veio: aparece "Tentar de novo". */
      canRetry: boolean;
    }
  | {
      stage: "pick";
      sub: string;
      /** O nome da categoria que está na tela. */
      title: string;
      intro: string;
      /** "3 marcados" ou "Nenhum marcado…". */
      count: string;
      dishes: MenuPickDish[];
      /** "Marcar todos" ou, quando todos já estão marcados, "Tirar todos". */
      markAll: string;
      notice: string;
      next: string;
      canNext: boolean;
      note: string;
      /** O que o leitor de tela fala quando a categoria muda. */
      live: string;
    }
  | {
      stage: "prices";
      sub: string;
      /** Muda a cada prato: quem desenha usa como chave para o campo recomeçar com o foco. */
      dishId: string;
      name: string;
      group: string;
      /** O preço que já está nele ("12,50") ou vazio. */
      value: string;
      problem: string;
      next: string;
    }
  | { stage: "pages"; sub: string; pages: MenuPageThumb[]; busy: boolean; canAdd: boolean; canRead: boolean; readLabel: string; message: string }
  | { stage: "reading"; sub: string; text: string }
  | {
      stage: "speak";
      sub: string;
      listening: boolean;
      canListen: boolean;
      /** As palavras que o aparelho já ouviu, enquanto a pessoa ainda fala. */
      heard: string;
      notice: string;
      groups: MenuHeardGroup[];
      unclear: string[];
      count: number;
      finish: string;
    }
  | {
      stage: "review";
      sub: string;
      intro: string;
      /** O prato sem preço fica separado no alto: é o que falta decidir. */
      missing: MenuReviewDish[];
      groups: MenuReviewGroup[];
      editing: string | null;
      saveLabel: string;
      saveNote: string;
      canSave: boolean;
      error: string;
    }
  | { stage: "done"; sub: string; headline: string; detail: string; next: string[] };

// ---------------------------------------------------------------- Pratos e categorias

/** Um prato na lista de quem cuida do cardápio. O botão do dia a dia é "Esgotou" (ou "Voltou", quando já esgotou). */
export type DishRow = {
  id: string;
  name: string;
  price: string;
  /** Só vale se for endereço de foto do próprio restaurante (`mediaUrl`); senão fica sem foto. */
  photo?: string;
  soldOut: boolean;
  /** "2 grupos de opções" ou nada: só informa. */
  badge?: string;
  /** Só para quem cuida do cardápio: o prato não tem foto (o cartão diz "Sem foto"). */
  noPhoto?: boolean;
  /** A palavra do botão ("Esgotou" ou "Voltou") e a frase que o leitor de tela fala ("Pizza esgotou"). */
  toggle: string;
  toggleSpoken: string;
  /** O primeiro toque na lixeira já foi dado: o segundo remove. */
  armed: boolean;
  /** O formulário de cima está mudando este prato: o cartão fica de lado e os botões esperam. */
  editing: boolean;
};

export type DishListSection = { title: string; rows: DishRow[] };

export type DishList = { key: string; title: string; count: string; sections: DishListSection[] };

export type DishesView = {
  title: string;
  sub: string;
  /** O que o leitor de tela fala quando algo muda. */
  live: string;
  loading: boolean;
  /** Dono e gerente criam e removem; a cozinha só marca o que esgotou. */
  canManage: boolean;
  showSearch: boolean;
  /** "2 pratos esgotados. O cliente vê, mas não consegue pedir." ou vazio. */
  alert: string;
  lists: DishList[];
  empty: string;
  categories: { id: string; name: string }[];
  error: string;
  notice: string;
  /** Só para quem cuida do cardápio: "5 pratos estão sem foto. Toque no lápis do prato para pôr a foto." ou vazio. */
  hint?: string;
};

/** A foto do prato aberto no lápis: o endereço da foto de agora ("" quando não há), o que está acontecendo e a frase. */
export type DishPhotoView = { src: string; phase: "idle" | "working" | "error" | "done"; message: string };

/**
 * O que está escrito no formulário do prato. `editId` é o prato que está sendo mudado (o formulário vem preenchido);
 * `null` é o prato novo.
 */
export type DishForm = {
  name: string;
  price: string;
  menuId: string;
  description: string;
  problem: "" | "name" | "twice" | "price";
  editId: string | null;
};

export type CategoryRow = { id: string; name: string; count: string; armed: boolean };

export type CategoriesView = {
  sub: string;
  live: string;
  loading: boolean;
  rows: CategoryRow[];
  empty: string;
  error: string;
  notice: string;
};


// ------------------------------------------------------------------------------------------------ opções do prato

/** No lápis do prato: o que o prato tem de opções hoje (uma frase) e o que o botão diz. Sem isto (prato novo) a parte não aparece. */
export type DishOptionsLine = { summary: string; button: string };

export type OptionItemView = {
  uid: string;
  /** O que está escrito no nome e no preço (o preço como a pessoa escreve: "6,50"; vazio = não custa a mais). */
  name: string;
  price: string;
  /** Tem (a pessoa pode escolher) ou Acabou. */
  active: boolean;
  /** Como o leitor de tela chama esta opção: o nome, ou "opção 2" enquanto está sem nome. */
  spoken: string;
};

export type OptionGroupView = {
  uid: string;
  /** Posição do grupo na lista (1, 2…), para o leitor de tela quando o grupo ainda não tem nome. */
  position: number;
  name: string;
  /** A regra em palavras, do jeito que o cliente vai ver: "O cliente escolhe 1." */
  sentence: string;
  required: boolean;
  max: number;
  canMore: boolean;
  canLess: boolean;
  min: number;
  canMinMore: boolean;
  canMinLess: boolean;
  items: OptionItemView[];
  canAddItem: boolean;
  /** A lixeira do grupo já recebeu o primeiro toque. */
  armed: boolean;
};

/** O que foi ouvido ou escrito e o que o sistema entendeu. Nada disto foi salvo ainda. */
export type OptionsHeardView = {
  said: string;
  lines: string[];
  notes: string[];
  /** Frase de quando nada foi entendido ("Não ouvi nada." ou "Não entendi nenhuma opção." + como falar). */
  unclear: string;
};

export type DishOptionsView = {
  stage: "loading" | "error" | "ready";
  title: string;
  sub: string;
  /** Frase de apoio de cima: o que fazer agora. */
  intro: string;
  /** Falha ao abrir (frase do servidor, quando veio). */
  error: string;
  canListen: boolean;
  listening: boolean;
  /** As palavras que o celular já ouviu, enquanto a pessoa fala. */
  heard: string;
  said: OptionsHeardView | null;
  groups: OptionGroupView[];
  /** Os modelos para tocar (Tamanho, Adicionais, Retirar, Outro grupo); vazio quando já não cabe mais grupo. */
  starters: { kind: string; label: string }[];
  startersLabel: string;
  dirty: boolean;
  saving: boolean;
  /** A frase da barra de baixo: o que falta para o cliente ver as opções. */
  hint: string;
  problems: string[];
  notice: { ok: boolean; text: string } | null;
  /** "Voltar" já recebeu o primeiro toque com coisa por salvar. */
  backArmed: boolean;
  /** A frase que o leitor de tela ouve a cada mudança. */
  live: string;
};

/* ------------------------------------------------------------------------------------------------ logomarca (20ª rodada) */

/** Uma figura para tocar: o tipo de comida, a cor da fachada ou o modelo da logomarca. */
export type LogoPick = {
  id: string;
  label: string;
  picked: boolean;
  /** Só nos tipos de comida: "parece ser este" (o sistema adivinhou pelo nome do restaurante). */
  hint?: string;
  /** Só nas cores: a cor da amostra. */
  color?: string;
};

export type LogoMakerView = {
  step: 1 | 2 | 3;
  stepText: string;
  question: string;
  /** Frase de apoio da pergunta (só na cor da fachada). */
  help: string;
  foods: LogoPick[];
  palettes: LogoPick[];
  models: LogoPick[];
  name: string;
  nameHelp: string;
  /** O nome ficou cortado em algum modelo: a frase manda encurtar. Vazio quando coube em todos. */
  cutNote: string;
  canListen: boolean;
  /** Qual pergunta está sendo ouvida agora: "food" (o que vende), "name" (o nome) ou vazio. */
  listening: "" | "food" | "name";
  heard: string;
  /** O que o sistema entendeu do que foi dito (ou que não entendeu). */
  said: string;
  /** Falta escolher algo para poder continuar (só o tipo de comida). */
  canNext: boolean;
  nextHint: string;
  saving: boolean;
  /** A frase do que deu errado ao salvar. */
  error: string;
};

export type LogoReviewView = {
  originalSrc: string;
  /** A versão sem a margem vazia; vazio quando não havia o que tirar. */
  refinedSrc: string;
  useRefined: boolean;
  /** A que vai ser salva, para mostrar como o cliente vê. */
  shownSrc: string;
  lead: string;
  restaurant: string;
  warnings: string[];
  /** Abrindo outra imagem ou salvando: os botões esperam. */
  busy: boolean;
  saving: boolean;
  error: string;
};

export type LogoHomeView = {
  logoSrc: string;
  hasLogo: boolean;
  lead: string;
  next: string;
  tip: string;
  makeLabel: string;
  /** O botão de remover já recebeu o primeiro toque. */
  removeArmed: boolean;
  /** Enquanto abre, salva ou remove, os botões esperam; a frase diz o que está acontecendo. */
  working: string;
  notice: { ok: boolean; text: string } | null;
};

export type LogoView = {
  stage: "loading" | "error" | "home" | "review" | "maker";
  title: string;
  sub: string;
  error: string;
  home: LogoHomeView | null;
  review: LogoReviewView | null;
  maker: LogoMakerView | null;
  /** A frase que o leitor de tela ouve a cada mudança. */
  live: string;
};

/** A tela de entrada do painel. */
export type LoginView = {
  /** O nome do restaurante, quando já se sabe; vazio quando não. */
  place: string;
  lead: string;
  /** "Seu acesso terminou…": o login acabou, não foi erro da pessoa. */
  notice: string;
  /** A frase do problema (campo vazio, senha errada, sem sinal); vazia quando está tudo certo. */
  problem: string;
  /** Qual campo tem o problema, para o foco ir até ele; `null` quando o problema é da conexão ou do servidor. */
  problemField: "email" | "password" | null;
  email: string;
  password: string;
  showPassword: boolean;
  busy: boolean;
  /** A frase que o leitor de tela lê quando algo muda. */
  live: string;
};

/** Um aviso no alto do painel (plano, pedido novo, mesa chamando). */
export type ShellNotice = { id: string; tone: "info" | "warn" | "urgent"; text: string; action: string };
