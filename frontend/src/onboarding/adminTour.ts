import type { TourStep } from "./tourEngine";

/** Bump the id when the script changes a lot, so owners see the new guide. */
export const ADMIN_TOUR_ID = "admin-v2";

/**
 * Guided setup for a restaurant owner: categories, dishes, tables and QR
 * codes, in the order that makes the menu work. Every target is an element
 * id in AdminPanel.tsx; tests/onboarding/adminTour.test.mjs fails if a step
 * points to an id that no longer exists.
 *
 * Writing rules: short sentences, one action per step, the same words that
 * are printed on the buttons.
 */
export const ADMIN_TOUR: TourStep[] = [
  {
    id: "boas-vindas",
    title: "Vamos montar o seu cardápio",
    text:
      "Eu vou te guiar passo a passo. Você pode tocar nos botões ou falar comigo. " +
      "Para seguir, diga próximo. Para ouvir de novo, diga repetir.",
    say: "próximo",
  },
  {
    id: "aba-categorias",
    title: "Primeiro, as categorias",
    text:
      "Toque em Categorias. É aqui que você separa o cardápio, " +
      "por exemplo: Pratos, Bebidas e Sobremesas.",
    target: "#admin-tab-categorias",
    advanceOnClick: true,
    say: "próximo",
  },
  {
    id: "nome-categoria",
    title: "Dê um nome à categoria",
    text: "Escreva o nome da primeira categoria. Por exemplo: Pratos.",
    target: "#admin-menu-name",
    view: "categorias",
  },
  {
    id: "salvar-categoria",
    title: "Salve a categoria",
    text:
      "Toque em Adicionar Categoria. Depois repita para as outras, " +
      "como Bebidas e Sobremesas.",
    target: "#admin-menu-add",
    view: "categorias",
    advanceOnClick: true,
  },
  {
    id: "aba-produtos",
    title: "Agora, os pratos",
    text: "Toque em Produtos. Aqui ficam os pratos e bebidas que o cliente vai ver.",
    target: "#admin-tab-produtos",
    advanceOnClick: true,
  },
  {
    id: "nome-produto",
    title: "Nome do prato",
    text: "Escreva o nome do prato. Por exemplo: Combinado de 20 peças.",
    target: "#admin-product-name",
    view: "produtos",
  },
  {
    id: "preco-produto",
    title: "Preço",
    text: "Escreva o preço, só os números. Por exemplo: 49,90.",
    target: "#admin-product-price",
    view: "produtos",
  },
  {
    id: "categoria-produto",
    title: "Escolha a categoria",
    text: "Toque aqui e escolha a categoria do prato.",
    target: "#admin-product-menu",
    view: "produtos",
  },
  {
    id: "salvar-produto",
    title: "Salve o prato",
    text:
      "Toque em Adicionar Produto. Ele já aparece no cardápio do cliente. " +
      "Repita para cada prato.",
    target: "#admin-product-add",
    view: "produtos",
    advanceOnClick: true,
  },
  {
    id: "aba-mesas",
    title: "Agora, as mesas",
    text: "Toque em Mesas. Cada mesa recebe um QR Code só dela.",
    target: "#admin-tab-mesas",
    advanceOnClick: true,
  },
  {
    id: "numero-mesa",
    title: "Número da mesa",
    text: "Escreva o número da mesa. Por exemplo: 1.",
    target: "#admin-table-number",
    view: "mesas",
  },
  {
    id: "salvar-mesa",
    title: "Salve a mesa",
    text: "Toque em Adicionar Mesa. Repita para todas as mesas do salão.",
    target: "#admin-table-add",
    view: "mesas",
    advanceOnClick: true,
  },
  {
    id: "qr-mesas",
    title: "O QR Code de cada mesa",
    text:
      "Aqui aparece o QR Code de cada mesa. Imprima e cole na mesa. " +
      "O cliente aponta a câmera do celular e já faz o pedido.",
    target: "#admin-table-list",
    view: "mesas",
  },
  {
    id: "aba-pagamento",
    title: "Receba pelo Pix",
    text:
      "Toque em Pagamento. Aqui você coloca a sua chave Pix " +
      "e o cliente paga direto na sua conta.",
    target: "#admin-tab-pagamento",
    advanceOnClick: true,
  },
  {
    id: "chave-pix",
    title: "Sua chave Pix",
    text:
      "Escolha o tipo da chave e escreva a chave. " +
      "Depois escreva o nome do recebedor, a cidade e a sua senha.",
    target: "#admin-pix-key",
    view: "pagamento",
  },
  {
    id: "salvar-pix",
    title: "Salve e teste",
    text:
      "Toque em Salvar Pix. Depois toque em Ver código de teste e pague R$ 1,00 " +
      "para conferir se o dinheiro cai na sua conta.",
    target: "#admin-pix-save",
    view: "pagamento",
  },
  {
    id: "aba-pedidos",
    title: "Por fim, os pedidos",
    text:
      "Quando um cliente pedir, o pedido aparece em Pedidos e o painel avisa você. " +
      "Toque em Pedidos para ver essa tela.",
    target: "#admin-tab-pedidos",
    advanceOnClick: true,
  },
  {
    id: "fim",
    title: "Tudo pronto!",
    text:
      "Seu cardápio está montado. Se quiser ouvir este guia de novo, " +
      "toque em Guia, aqui em cima.",
    target: "#admin-btn-guide",
    say: "pronto",
  },
];
