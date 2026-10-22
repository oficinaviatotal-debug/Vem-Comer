/**
 * Dados de EXEMPLO só para desenhar as telas novas. Nada disso vem do servidor, e nenhuma tela de verdade pode
 * importar este arquivo: as telas recebem os dados por props, e quem liga ao servidor vem depois.
 * As "fotos" são emojis no lugar da foto do prato; na tela de verdade entra a foto do restaurante.
 */

import type { MyCall } from "../loja/tableLogic.ts";
import type { KitchenOrder } from "../cozinha/kitchenLogic";
import type { PanelOrder } from "../painel/ordersLogic";
import { normalizeCash, normalizeOrders, type CashView, type CourierOrder } from "../courier/courierLogic";
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

/**
 * O que a mesa de exemplo já chamou. "novo": nada. "chamado": a conta foi chamada há 10 s (afundada, espere), a água
 * já foi atendida (verde) e o garçom foi chamado há 90 s sem resposta ("Ainda não veio?").
 */
export function callsExample(stage: "novo" | "chamado", now: number): MyCall[] {
  if (stage === "novo") return [];
  return [
    { id: "c1", kind: "conta", status: "open", savedAt: now - 10_000 },
    { id: "c2", kind: "agua", status: "answered", savedAt: now - 300_000 },
    { id: "c3", kind: "garcom", status: "open", savedAt: now - 90_000 },
  ];
}

/**
 * As mesas de EXEMPLO da tela de mesas do painel: o cadastro, os chamados abertos (como o servidor os manda) e os pedidos
 * andando. Passam pela mesma conta da tela de verdade (painel/deskLogic).
 */
export const DESK_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((number) => ({ id: `mesa-${number}`, number }));

export function deskCallsExample(): unknown[] {
  return [
    { id: "d1", table_id: "mesa-7", table_number: 7, kind: "garcom", label: "Garçom", text: "Mesa 7 chama o garçom", waiting_seconds: 515, repeats: 2, urgency: "urgent" },
    { id: "d2", table_id: "mesa-4", table_number: 4, kind: "conta", label: "Conta", text: "Mesa 4 pede a conta", waiting_seconds: 215, repeats: 0, urgency: "late" },
    { id: "d3", table_id: "mesa-12", table_number: 12, kind: "agua", label: "Água", text: "Mesa 12 pede água", waiting_seconds: 35, repeats: 0, urgency: "normal" },
    { id: "d4", table_id: "mesa-4", table_number: 4, kind: "limpeza", label: "Limpeza", text: "Mesa 4 pede limpeza da mesa", waiting_seconds: 70, repeats: 0, urgency: "normal" },
  ];
}

export function deskOrdersExample(now: number): { id: string; status: string; order_type: string; table_number: number; customer_name: string | null; total_price: number; created_at: string }[] {
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  return [
    { id: "p1", status: "em preparo", order_type: "mesa", table_number: 4, customer_name: "Ana", total_price: 52.5, created_at: ago(14) },
    { id: "p2", status: "PENDING_PAYMENT", order_type: "mesa", table_number: 4, customer_name: null, total_price: 18, created_at: ago(1) },
    { id: "p3", status: "em preparo", order_type: "mesa", table_number: 9, customer_name: "Carlos", total_price: 89.9, created_at: ago(6) },
    { id: "p4", status: "concluido", order_type: "mesa", table_number: 4, customer_name: "Ana", total_price: 24, created_at: ago(55) },
  ];
}

/**
 * Pedidos de EXEMPLO do painel, de todo jeito: mesa, entrega, retirada, dinheiro com troco, Pix a receber e já pago,
 * entrega a caminho e encerrados. Só a conferência usa isto; a tela de verdade lê o que o servidor manda.
 */
export function panelOrders(now: number): PanelOrder[] {
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  return [
    {
      id: "0042-exemplo",
      customer_name: "Dona Lúcia",
      status: "PENDING_PAYMENT",
      created_at: ago(7),
      order_type: "mesa",
      table_number: "4",
      total_price: 42,
      payment_method: "dinheiro",
      payment_status: "PENDING",
      payment_change: 50,
      items: [
        { name: "Açaí 500 ml", quantity: 2, options: [{ name: "granola" }, { name: "banana" }], note: "sem leite condensado" },
        { name: "Suco de caju", quantity: 1 },
      ],
    },
    {
      id: "0043-exemplo",
      customer_name: "Marcos",
      status: "PENDING_PAYMENT",
      created_at: ago(3),
      order_type: "entrega",
      delivery_fee: 6,
      delivery_zone: "Centro",
      delivery_address: { street: "Rua das Flores", number: "120", complement: "apto 3", neighborhood: "Centro", cep: "59000000", reference: "Portão azul" },
      customer_phone: "84999998888",
      total_price: 48,
      payment_method: "pix",
      payment_status: "PENDING",
      payment_change: 0,
      items: [
        { name: "X-Burguer", quantity: 1 },
        { name: "Batata média", quantity: 1 },
      ],
    },
    {
      id: "0040-exemplo",
      customer_name: "Cliente Balcão",
      status: "PENDING_PAYMENT",
      created_at: ago(24),
      order_type: "mesa",
      table_number: "2",
      total_price: 18.5,
      payment_method: "cartao",
      payment_status: "PENDING",
      payment_change: 0,
      items: [{ name: "Açaí 300 ml", quantity: 1, options: [{ name: "sem granola" }] }],
    },
    {
      id: "0041-exemplo",
      customer_name: "Rafael",
      status: "em preparo",
      created_at: ago(12),
      order_type: "mesa",
      table_number: "6",
      total_price: 31.5,
      payment_method: "pix",
      payment_status: "PAID",
      payment_change: 0,
      items: [{ name: "Pastel de queijo", quantity: 3 }],
    },
    {
      id: "0039-exemplo",
      customer_name: "Paula",
      status: "em preparo",
      created_at: ago(18),
      order_type: "retirada",
      customer_phone: "84988887777",
      total_price: 59.8,
      payment_method: "dinheiro",
      payment_status: "PENDING",
      payment_change: 100,
      items: [{ name: "X-Burguer", quantity: 2, note: "um sem cebola" }],
    },
    {
      id: "0038-exemplo",
      customer_name: "Seu Zé",
      status: "pronto",
      created_at: ago(25),
      order_type: "entrega",
      delivery_fee: 6,
      delivery_zone: "Tirol",
      delivery_address: { street: "Av. Hermes da Fonseca", number: "800", neighborhood: "Tirol", cep: "59020000" },
      customer_phone: "84977776666",
      total_price: 33,
      payment_method: "dinheiro",
      payment_status: "PENDING",
      payment_change: 50,
      items: [{ name: "Açaí 500 ml", quantity: 1 }],
    },
    {
      id: "0035-exemplo",
      customer_name: "Ana",
      status: "saiu para entrega",
      created_at: ago(40),
      order_type: "entrega",
      delivery_fee: 5,
      delivery_zone: "Centro",
      delivery_address: { street: "Rua do Sol", number: "45", neighborhood: "Centro" },
      customer_phone: "84966665555",
      courier_name: "Carlos",
      total_price: 27,
      payment_method: "pix",
      payment_status: "PAID",
      payment_change: 0,
      items: [{ name: "Pastel de carne", quantity: 2 }],
    },
    {
      id: "0037-exemplo",
      customer_name: "Beto",
      status: "concluido",
      created_at: ago(55),
      order_type: "mesa",
      table_number: "3",
      total_price: 22,
      payment_method: "cartao",
      payment_status: "PENDING",
      payment_change: 0,
      items: [{ name: "Suco de caju", quantity: 2 }],
    },
    {
      id: "0036-exemplo",
      customer_name: "Cliente Balcão",
      status: "concluido",
      created_at: ago(70),
      order_type: "mesa",
      table_number: "1",
      total_price: 36,
      payment_method: "dinheiro",
      payment_status: "PAID",
      payment_change: 40,
      items: [{ name: "Pastel de queijo", quantity: 4 }],
    },
  ];
}

/**
 * As entregas de EXEMPLO, no formato que o servidor manda (passam pelo `normalizeOrders` da tela de verdade): duas na rua com o
 * motoqueiro (uma com dinheiro e troco, uma já paga no Pix), duas para pegar, uma com outro motoqueiro (só o gerente vê) e três
 * entregues (dinheiro ainda com ele, dinheiro já acertado, sem dinheiro). O código do cliente de exemplo é 4821.
 */
export function courierOrders(now: number, withOthers = false): CourierOrder[] {
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  const rows: Record<string, unknown>[] = [
    { id: "a1b2-going-1", customer_name: "Marcos Oliveira", phone: "(84) 99999-8888", address: "Rua das Flores, 120, apto 3, Centro", reference: "Portão azul", zone: "Centro", status: "saiu para entrega", total: "48.00", payment_method: "dinheiro", cash_to_receive: "48.00", change_for: "100.00", change_back: "52.00", mine: true, taken_by_other: false, needs_code: true, picked_up_at: ago(6), delivered_at: null, cash_received: "", settled: false },
    { id: "c3d4-going-2", customer_name: "Ana Paula", phone: "(84) 98888-7777", address: "Av. Hermes da Fonseca, 800, Tirol", reference: "", zone: "Tirol", status: "saiu para entrega", total: "62.50", payment_method: "pix", cash_to_receive: "0.00", change_for: "", change_back: "", mine: true, taken_by_other: false, needs_code: true, picked_up_at: ago(9), delivered_at: null, cash_received: "", settled: false },
    { id: "e5f6-ready-1", customer_name: "Seu João", phone: "(84) 97777-6666", address: "Rua Mossoró, 45, Petrópolis", reference: "Perto da padaria", zone: "Petrópolis", status: "pronto", total: "35.00", payment_method: "dinheiro", cash_to_receive: "35.00", change_for: "35.00", change_back: "", mine: false, taken_by_other: false, needs_code: true, picked_up_at: null, delivered_at: null, cash_received: "", settled: false },
    { id: "a7b8-ready-2", customer_name: "Dona Rita", phone: "", address: "", reference: "", zone: "", status: "pronto", total: "28.00", payment_method: "pix", cash_to_receive: "0.00", change_for: "", change_back: "", mine: false, taken_by_other: false, needs_code: true, picked_up_at: null, delivered_at: null, cash_received: "", settled: false },
    { id: "c9d0-done-1", customer_name: "Beatriz Lima", phone: "(84) 96666-5555", address: "Rua Trairi, 10, Tirol", reference: "", zone: "Tirol", status: "concluido", total: "35.00", payment_method: "dinheiro", cash_to_receive: "35.00", change_for: "", change_back: "", mine: true, taken_by_other: false, needs_code: true, picked_up_at: ago(70), delivered_at: ago(48), cash_received: "35.00", settled: false },
    { id: "e1f2-done-2", customer_name: "Paulo Souza", phone: "", address: "Rua Seridó, 300, Centro", reference: "", zone: "Centro", status: "concluido", total: "60.00", payment_method: "dinheiro", cash_to_receive: "60.00", change_for: "", change_back: "", mine: true, taken_by_other: false, needs_code: true, picked_up_at: ago(130), delivered_at: ago(100), cash_received: "60.00", settled: true },
    { id: "a3b4-done-3", customer_name: "Lia Campos", phone: "", address: "Rua Ceará-Mirim, 77, Petrópolis", reference: "", zone: "Petrópolis", status: "concluido", total: "41.00", payment_method: "pix", cash_to_receive: "0.00", change_for: "", change_back: "", mine: true, taken_by_other: false, needs_code: true, picked_up_at: ago(150), delivered_at: ago(125), cash_received: "", settled: false },
  ];
  if (withOthers) {
    rows.push({ id: "c5d6-other-1", customer_name: "Carlos Mendes", phone: "(84) 95555-4444", address: "Rua Apodi, 9, Alecrim", reference: "", zone: "Alecrim", status: "saiu para entrega", total: "52.00", payment_method: "dinheiro", cash_to_receive: "52.00", change_for: "", change_back: "", mine: false, taken_by_other: true, needs_code: true, picked_up_at: ago(12), delivered_at: null, cash_received: "", settled: false });
  }
  return normalizeOrders(rows);
}

/** O acerto de EXEMPLO: dois motoqueiros, passando pela conta de verdade (`normalizeCash`). */
export function cashExample(now: number): CashView {
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  return normalizeCash({
    couriers: [
      {
        courier_id: "m1",
        name: "Ana Silva",
        total: "145.50",
        orders: [
          { id: "x1", customer_name: "Beatriz Lima", amount: "35.00", zone: "Tirol", delivered_at: ago(48) },
          { id: "x2", customer_name: "Marcos Oliveira", amount: "48.00", zone: "Centro", delivered_at: ago(80) },
          { id: "x3", customer_name: "Seu João", amount: "62.50", zone: "Petrópolis", delivered_at: ago(130) },
        ],
      },
      {
        courier_id: "m2",
        name: "Pedro Gomes",
        total: "52.00",
        orders: [{ id: "x4", customer_name: "Carlos Mendes", amount: "52.00", zone: "Alecrim", delivered_at: ago(20) }],
      },
    ],
  });
}

/** O cardápio que o servidor leu da foto, de EXEMPLO: um prato sem preço, um preço que parece engano de escuta e um nome comprido. */
export const MENU_READ_EXAMPLE = {
  readable: true,
  notes: "",
  categories: [
    {
      name: "Lanches",
      items: [
        { name: "X-tudo", price: "25.00" },
        { name: "X-salada", price: "22.00" },
        { name: "Hambúrguer artesanal", price: "28.00" },
        { name: "X-bacon", price: "" },
      ],
    },
    {
      name: "Porções",
      items: [
        { name: "Batata frita com cheddar e bacon (serve duas pessoas)", price: "38.00" },
        { name: "Calabresa acebolada", price: "" },
      ],
    },
    {
      name: "Bebidas",
      items: [
        { name: "Coca-Cola lata", price: "300" },
        { name: "Suco de laranja", price: "9.00" },
        { name: "Água mineral", price: "4.00" },
      ],
    },
  ],
};

/** O que a pessoa falou, de EXEMPLO, passando pela conta de verdade (`takeSpoken`). */
export const MENU_SPOKEN_EXAMPLE = ["x-tudo 25, x-salada 22, hambúrguer 28", "bebidas coca lata 6, suco de laranja 9, água"];
