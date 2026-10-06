import type { TourStep } from "./tourEngine";

/** Bump the id when the script changes a lot, so owners see the new guide. */
export const ADMIN_TOUR_ID = "admin-v3";

/**
 * Guided tour of a restaurant owner's panel: tables and QR codes, Pix and
 * orders. Every target is an element id in AdminPanel.tsx;
 * tests/onboarding/adminTour.test.mjs fails if a step points to an id that no
 * longer exists.
 *
 * The menu itself is NOT part of this tour: typing category and dish names
 * does not work for owners who barely write. The Assistente tab does that by
 * voice and touch (see src/assistant), so the tour only points to it.
 *
 * Writing rules: short sentences, one action per step, the same words that
 * are printed on the buttons.
 */
export const ADMIN_TOUR: TourStep[] = [
  {
    id: "boas-vindas",
    title: "Vamos conhecer o seu painel",
    text:
      "Eu mostro as mesas, o Pix e os pedidos. Pode tocar nos botões ou falar comigo. " +
      "Para seguir, diga próximo.",
    say: "próximo",
  },
  {
    id: "assistente",
    title: "O cardápio é no Assistente",
    text:
      "Para montar o cardápio, use a aba Assistente. " +
      "Ele pergunta e você só fala ou toca. Não precisa escrever.",
    target: "#admin-tab-assistente",
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
    dictate: "integer",
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
