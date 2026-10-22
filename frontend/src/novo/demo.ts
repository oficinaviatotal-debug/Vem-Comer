/**
 * Dados de EXEMPLO só para desenhar as telas novas. Nada disso vem do servidor, e nenhuma tela de verdade pode
 * importar este arquivo: as telas recebem os dados por props, e quem liga ao servidor vem depois.
 * As "fotos" são emojis no lugar da foto do prato; na tela de verdade entra a foto do restaurante.
 */

import type { KitchenOrder } from "../cozinha/kitchenLogic";
import type { Cart, Category, Dish, Job, Promo, Shop, Today } from "./types";

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
