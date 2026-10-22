/**
 * Dados de EXEMPLO só para desenhar as telas novas. Nada disso vem do servidor, e nenhuma tela de verdade pode
 * importar este arquivo: as telas recebem os dados por props, e quem liga ao servidor vem depois.
 * As "fotos" são emojis no lugar da foto do prato; na tela de verdade entra a foto do restaurante.
 */

import type { Cart, Category, Dish, Job, Promo, Shop, Tab, Ticket, Today } from "./types";

export const SHOP: Shop = {
  name: "Açaí do João",
  mark: "🍇",
  city: "Natal - RN",
  openUntil: "23h",
  eta: "30–40 min",
  fee: 5,
};

export const CATEGORIES: Category[] = [
  { id: "promo", label: "Promoções", art: "🔥", on: true },
  { id: "acai", label: "Açaí", art: "🍇" },
  { id: "lanches", label: "Lanches", art: "🍔" },
  { id: "bebidas", label: "Bebidas", art: "🥤" },
  { id: "doces", label: "Sobremesas", art: "🍨" },
];

export const PROMO: Promo = { title: "Combo Especial", price: 29.9, note: "Açaí 500 ml e um suco de caju", art: "🍇" };

export const DISHES: Dish[] = [
  { id: "d1", name: "Açaí 300 ml", price: 14, art: "🍇" },
  { id: "d2", name: "Açaí 500 ml", price: 19, art: "🍧" },
  { id: "d3", name: "X-Burguer", price: 18, art: "🍔" },
  { id: "d4", name: "Suco de caju", price: 7, art: "🥤" },
  { id: "d5", name: "Pastel de queijo", price: 9, art: "🥟" },
  { id: "d6", name: "Sorvete 2 bolas", price: 10, art: "🍨" },
];

export const CART: Cart = { items: 2, total: 33 };

export const TODAY: Today = {
  greeting: "Bom dia, João",
  dateLine: "Quarta, 21 de outubro. Aberto desde as 10h.",
  waiting: 3,
  oldestMinutes: 7,
  cooking: 4,
  onTheWay: 2,
  calling: 1,
  todo: [
    { id: "t1", kind: "call" as const, title: "Mesa 4 está chamando", note: "Faz 2 minutos", action: "Atender" },
    { id: "t2", kind: "pix" as const, title: "2 Pix para conferir", note: "R$ 96,00 no total", action: "Conferir" },
  ],
  salesTotal: 1284.5,
  salesOrders: 38,
  averageTicket: 33.8,
  hours: [3, 6, 9, 5, 2, 3, 4, 8, 11, 14, 12, 7, 2],
  hoursFrom: 10,
  nowIndex: 10,
};

export const TICKETS: Ticket[] = [
  {
    id: "k1",
    number: "#42",
    where: "Mesa 4",
    minutes: 7,
    lines: [
      { qty: 2, name: "Açaí 500 ml", detail: "granola e banana" },
      { qty: 1, name: "Suco de caju" },
    ],
    note: "Sem leite condensado",
    action: "Começar a fazer",
  },
  {
    id: "k2",
    number: "#43",
    where: "Entrega",
    minutes: 3,
    lines: [
      { qty: 1, name: "X-Burguer" },
      { qty: 1, name: "Batata média" },
    ],
    action: "Começar a fazer",
  },
  {
    id: "k3",
    number: "#40",
    where: "Mesa 2",
    minutes: 24,
    lines: [{ qty: 1, name: "Açaí 300 ml", detail: "sem granola" }],
    action: "Começar a fazer",
  },
];

export const JOBS: Job[] = [
  { id: "j1", title: "Atendente de loja", company: "Mercadinho Bom Preço", city: "Natal - RN", mode: "Presencial", contract: "CLT", ago: "Há 2 horas" },
  { id: "j2", title: "Auxiliar de cozinha", company: "Bistrô Sabor e Arte", city: "Natal - RN", mode: "Presencial", contract: "CLT", ago: "Há 5 horas" },
  { id: "j3", title: "Motoboy com moto própria", company: "Açaí do João", city: "Natal - RN", mode: "Presencial", contract: "Por entrega", ago: "Ontem" },
];

export const KITCHEN_TABS: Tab[] = [
  { id: "new", label: "Novos", count: 3 },
  { id: "doing", label: "Fazendo", count: 2 },
  { id: "ready", label: "Prontos", count: 1 },
];
