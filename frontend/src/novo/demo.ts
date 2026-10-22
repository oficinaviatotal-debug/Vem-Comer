/**
 * Dados de EXEMPLO só para desenhar as telas novas. Nada disso vem do servidor, e nenhuma tela de verdade pode
 * importar este arquivo: as telas recebem os dados por props, e quem liga ao servidor vem depois.
 * As "fotos" são emojis no lugar da foto do prato; na tela de verdade entra a foto do restaurante.
 */

import type { KitchenOrder } from "../cozinha/kitchenLogic";
import { hourOf, todayOf } from "../hoje/todayLogic";
import { shopViewOf, type ShopView } from "../loja/shopLogic";
import type { Job, Promo, Today } from "./types";
import type { OrderView, Product } from "../customer/types";

/**
 * O cardápio de EXEMPLO: restaurante, categorias e pratos no formato que o servidor manda, passando pela mesma conta
 * que a tela de verdade usa (loja/shopLogic). Só os emojis (no lugar da foto do prato) e o card de promoção são
 * enfeite da conferência: o servidor ainda não tem promoção, e com dados de verdade essa seção não aparece.
 */
const ART: Record<string, string> = {
  a1: "🍇",
  a2: "🍧",
  a3: "🥣",
  l1: "🍔",
  l2: "🥟",
  b1: "🥤",
  b2: "🧃",
  s1: "🍨",
  s2: "🍰",
};
const CATEGORY_ART: Record<string, string> = { acai: "🍇", lanches: "🍔", bebidas: "🥤", doces: "🍨" };

export const PROMO: Promo = { title: "Combo Especial", price: 29.9, note: "Açaí 500 ml e um suco de caju", art: "🍇" };

export function shopExample(): ShopView {
  const sizes = [
    {
      id: "g-size",
      name: "Tamanho",
      min_choices: 1,
      max_choices: 1,
      items: [
        { id: "o1", name: "300 ml", price_delta: 0 },
        { id: "o2", name: "500 ml", price_delta: 5 },
      ],
    },
  ];
  const product = (id: string, menu_id: string, name: string, price: number, extra: Record<string, unknown> = {}) => ({
    id,
    menu_id,
    name,
    price,
    ...extra,
  });
  const view = shopViewOf({
    company: {
      name: "Açaí do João",
      logo_thumb_url: null,
      accepting_orders: true,
      hours: { configured: true, open_now: true, message: "Aberto até 23h.", paused: false },
    },
    fromTable: false,
    tableNumber: null,
    menus: [
      { id: "acai", name: "Açaí" },
      { id: "lanches", name: "Lanches" },
      { id: "bebidas", name: "Bebidas" },
      { id: "doces", name: "Sobremesas" },
    ],
    products: [
      product("a1", "acai", "Açaí no copo", 14, { description: "Com banana e granola", option_groups: sizes }),
      product("a2", "acai", "Açaí 500 ml", 19, { description: "Granola, banana e leite em pó" }),
      product("a3", "acai", "Tigela de açaí", 24, { description: "Frutas da época" }),
      product("l1", "lanches", "X-Burguer", 18, { description: "Pão, carne de 150 g e queijo" }),
      product("l2", "lanches", "Pastel de queijo", 9),
      product("b1", "bebidas", "Suco de caju", 7, { description: "Natural, sem açúcar" }),
      product("b2", "bebidas", "Suco de acerola", 7, { sold_out: true }),
      product("s1", "doces", "Sorvete 2 bolas", 10),
      product("s2", "doces", "Bolo de pote", 12),
    ] as never,
    cart: [{ id: "a2", name: "Açaí 500 ml", price: 19, quantity: 2 }],
    query: "",
    media: () => "",
  });
  return {
    ...view,
    shop: { ...view.shop, mark: "🍇" },
    categories: view.categories.map((cat) => ({ ...cat, art: CATEGORY_ART[cat.id] })),
    groups: view.groups.map((group) => ({
      ...group,
      sections: group.sections.map((section) => ({
        ...section,
        dishes: section.dishes.map((dish) => ({ ...dish, art: ART[dish.id] })),
      })),
    })),
  };
}

/**
 * O "Hoje" de EXEMPLO: pedidos, mesa chamando e vendas no formato que o servidor manda, passando pela mesma conta
 * que a tela de verdade usa (hoje/todayLogic). `now` entra de fora para os minutos e as horas baterem com a conferência.
 */
export function todayExample(now: number): Today {
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  const order = (status: string, minutes: number, extra: Record<string, unknown> = {}) => ({
    status,
    created_at: ago(minutes),
    order_type: "mesa",
    payment_method: "dinheiro",
    payment_status: "PENDING",
    total_price: 30,
    ...extra,
  });
  const pix = { payment_method: "pix", payment_status: "PENDING", total_price: 48 };
  // As vendas de exemplo terminam na hora de agora (nunca há venda no futuro).
  const sold = [3, 6, 9, 5, 2, 3, 4, 8, 11, 14, 12, 7, 2];
  const nowHour = hourOf(now);
  const orderCountAt = (hour: number) => sold[hour - (nowHour - (sold.length - 1))] ?? 0;
  return todayOf({
    name: "João da Silva",
    role: "OWNER",
    now,
    orders: [
      order("PENDING_PAYMENT", 7, pix),
      order("PENDING_PAYMENT", 3, pix),
      order("PENDING_PAYMENT", 5),
      order("em preparo", 12),
      order("em preparo", 18),
      order("em preparo", 9),
      order("em preparo", 4),
      order("saiu para entrega", 30, { order_type: "entrega" }),
      order("saiu para entrega", 22, { order_type: "entrega" }),
    ],
    calls: [
      { id: "c1", table_number: 4, kind: "garcom", label: "Garçom", text: "Mesa 4 chama o garçom", waiting_seconds: 120, repeats: 0, urgency: "normal" },
    ],
    business: {
      summary: { revenue: 1284.5, orders: 38, avg_ticket: 33.8, dishes: 61, delivery_fees: 24 },
      hours: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: hour <= nowHour ? orderCountAt(hour) : 0, revenue: 0 })),
    },
  });
}

export const JOBS: Job[] = [
  { id: "j1", title: "Atendente de loja", company: "Mercadinho Bom Preço", city: "Natal - RN", mode: "Presencial", contract: "CLT", ago: "Há 2 horas" },
  { id: "j2", title: "Auxiliar de cozinha", company: "Bistrô Sabor e Arte", city: "Natal - RN", mode: "Presencial", contract: "CLT", ago: "Há 5 horas" },
  { id: "j3", title: "Motoboy com moto própria", company: "Açaí do João", city: "Natal - RN", mode: "Presencial", contract: "Por entrega", ago: "Ontem" },
];

/**
 * Pedidos de EXEMPLO no mesmo formato que o servidor manda. A página de conferência passa estes pedidos pela mesma
 * conta que a cozinha de verdade usa (cozinha/kitchenLogic), então o que se vê ali é o caminho real, não um desenho.
 * `now` entra de fora para os minutos de espera baterem com a hora da conferência.
 */
export function kitchenOrders(now: number): KitchenOrder[] {
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  return [
    {
      id: "0042-exemplo",
      status: "PENDING_PAYMENT",
      created_at: ago(7),
      order_type: "mesa",
      table_number: "4",
      items: [
        { name: "Açaí 500 ml", quantity: 2, options: [{ name: "granola" }, { name: "banana" }], note: "sem leite condensado" },
        { name: "Suco de caju", quantity: 1 },
      ],
    },
    {
      id: "0043-exemplo",
      status: "PENDING_PAYMENT",
      created_at: ago(3),
      order_type: "entrega",
      delivery_address: { street: "Rua das Flores", number: "120", neighborhood: "Centro" },
      items: [
        { name: "X-Burguer", quantity: 1 },
        { name: "Batata média", quantity: 1 },
      ],
    },
    {
      id: "0040-exemplo",
      status: "PENDING_PAYMENT",
      created_at: ago(24),
      order_type: "mesa",
      table_number: "2",
      items: [{ name: "Açaí 300 ml", quantity: 1, options: [{ name: "sem granola" }] }],
    },
    {
      id: "0041-exemplo",
      status: "em preparo",
      created_at: ago(12),
      order_type: "mesa",
      table_number: "6",
      items: [{ name: "Pastel de queijo", quantity: 3 }],
    },
    {
      id: "0039-exemplo",
      status: "em preparo",
      created_at: ago(18),
      order_type: "retirada",
      items: [{ name: "X-Burguer", quantity: 2, note: "um sem cebola" }],
    },
    {
      id: "0038-exemplo",
      status: "pronto",
      created_at: ago(25),
      order_type: "entrega",
      delivery_address: { street: "Av. Hermes da Fonseca", number: "800" },
      items: [{ name: "Açaí 500 ml", quantity: 1 }],
    },
  ];
}

/**
 * O prato de EXEMPLO das escolhas: um açaí com tamanho (escolha 1, obrigatório) e adicionais (até 3, vários).
 * Tem o formato que o servidor manda; o preço de cada opção é o que o restaurante cadastra.
 */
export const ACAI_PRODUCT: Product = {
  id: "a1",
  menu_id: "acai",
  name: "Açaí no copo",
  description: "Açaí batido na hora, com banana e granola. Escolha o tamanho e os adicionais que quiser.",
  price: 14,
  option_groups: [
    {
      id: "g-size",
      name: "Tamanho",
      min_choices: 1,
      max_choices: 1,
      items: [
        { id: "o1", name: "300 ml", price_delta: 0 },
        { id: "o2", name: "500 ml", price_delta: 5 },
        { id: "o3", name: "700 ml", price_delta: 9 },
      ],
    },
    {
      id: "g-extra",
      name: "Adicionais",
      min_choices: 0,
      max_choices: 3,
      items: [
        { id: "e1", name: "Leite em pó", price_delta: 2 },
        { id: "e2", name: "Granola extra", price_delta: 2 },
        { id: "e3", name: "Paçoca", price_delta: 3 },
        { id: "e4", name: "Leite condensado", price_delta: 3 },
      ],
    },
  ],
} as Product;

/** O que o servidor anuncia para um CEP de exemplo: entrega no centro, taxa e prazo. */
export const QUOTE_EXAMPLE = { available: true, zone: "Centro", fee: 6, min_order: 15, eta_minutes: 35 } as const;
export const QUOTE_NONE_EXAMPLE = { available: false, message: "Ainda não entregamos neste CEP." } as const;

/**
 * Um pedido de EXEMPLO, no formato que o servidor manda, em três momentos: `preparo` (retirada, Pix a pagar),
 * `rua` (entrega a caminho, com o código de 4 números) e `pronto` (pronto e pago, pedindo a avaliação).
 */
export function orderExample(kind: "preparo" | "rua" | "pronto"): OrderView {
  const items = [
    { name: "Açaí no copo", quantity: 1, total: 24, options: [{ id: "o2", group: "Tamanho", name: "500 ml", delta_price: 5 }, { id: "e2", group: "Adicionais", name: "Granola extra", delta_price: 2 }], note: "Sem granola em cima" },
    { name: "X-Burguer", quantity: 2, total: 36 },
    { name: "Suco de caju", quantity: 1, total: 7 },
  ];
  if (kind === "rua") {
    return {
      id: "b7c9d2e1-0000",
      customer_name: "Maria",
      total_price: 73,
      status: "saiu para entrega",
      items,
      payment_method: "dinheiro",
      payment_status: "PENDING",
      order_type: "entrega",
      delivery_fee: 6,
      delivery_zone: "Centro",
      delivery_address: { street: "Rua das Flores", number: "120", neighborhood: "Centro", city: "Natal" },
      customer_phone: "84999998888",
      delivery_code: "4821",
    } as unknown as OrderView;
  }
  return {
    id: kind === "pronto" ? "c3d4e5f6-0000" : "a1b2c3d4-0000",
    customer_name: "Maria",
    total_price: 67,
    status: kind === "pronto" ? "concluido" : "em preparo",
    items,
    payment_method: "pix",
    payment_status: kind === "pronto" ? "PAID" : "PENDING",
    order_type: "retirada",
    delivery_fee: null,
  } as unknown as OrderView;
}

/**
 * O Pix de EXEMPLO. O código e o QR são de mentira (o QR é só um desenho); o de verdade vem do servidor, que usa a
 * chave Pix cadastrada pelo restaurante.
 */
export function pixExample() {
  const cells = Array.from({ length: 29 * 29 }, (_, i) => ((i * 7919 + (i >> 3) * 104729) % 5 < 2 ? 1 : 0));
  const rects = cells
    .map((on, i) => (on ? `<rect x="${(i % 29) * 6 + 6}" y="${Math.floor(i / 29) * 6 + 6}" width="6" height="6"/>` : ""))
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
  return {
    payload:
      "00020126580014BR.GOV.BCB.PIX0136exemplo-nao-e-uma-chave-de-verdade5204000053039865406067.005802BR5911ACAI DO JOAO6005NATAL62070503***6304ABCD",
    qr_data_url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    receiver_name: "Açaí do João",
    amount: "67.00",
  };
}
