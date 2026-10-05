import type { TourStep } from "../onboarding/tourEngine";

/** Bump the id when the script changes a lot, so customers see the new guide. */
export const CUSTOMER_TOUR_ID = "cliente-v1";

/** The short guide that shows how to pay a Pix code, offered once when the first code appears. */
export const PIX_TOUR_ID = "cliente-pix-v1";

/** The guide's "seen" flag is per device (customers are not signed in). */
export const CUSTOMER_TOUR_USER = "visitante";

/** Screens of the customer app the guide can switch to. */
export const CUSTOMER_VIEWS = ["menu", "cart"] as const;

/**
 * Guided first order for a customer who scanned the table QR code. Targets
 * are element ids in the files of this folder; tests/onboarding/customerTour
 * fails if a step points to an id that no longer exists.
 *
 * Writing rules: short sentences, one action per step, the same words that
 * are printed on the buttons.
 */
export function customerTour(options: { hasCategories: boolean; hasPix?: boolean }): TourStep[] {
  const steps: TourStep[] = [
    {
      id: "boas-vindas",
      title: "Bem-vindo! Eu te ajudo a pedir",
      text:
        "Você escolhe o que quer e envia o pedido pelo celular, sem chamar o garçom. " +
        "Toque em Próximo ou diga próximo para seguir.",
      say: "próximo",
      view: "menu",
    },
  ];

  if (options.hasCategories) {
    steps.push({
      id: "categorias",
      title: "Vá direto ao que quer",
      text: "Toque numa categoria para ir até ela. Por exemplo: Bebidas.",
      target: "#cust-categories",
      view: "menu",
    });
  }

  steps.push(
    {
      id: "adicionar",
      title: "Escolha o seu prato",
      text: "Toque em Adicionar no prato que você quer. Para pedir mais de um, toque de novo.",
      target: "#cust-first-add",
      view: "menu",
      advanceOnClick: true,
    },
    {
      id: "barra-pedido",
      title: "Veja o seu pedido",
      text:
        "Quando terminar de escolher, toque em Ver pedido. " +
        "A barra com o total aparece aqui embaixo depois que você adiciona algo.",
      target: "#cust-cartbar",
      view: "menu",
      advanceOnClick: true,
    },
    {
      id: "nome",
      title: "Diga o seu nome",
      text: "Se quiser, escreva o seu nome. Assim o atendente te chama quando o pedido ficar pronto.",
      target: "#cust-name",
      view: "cart",
    },
    {
      id: "pagamento",
      title: "Escolha como vai pagar",
      text: options.hasPix
        ? "Toque em Pix, Cartão ou Dinheiro. Se escolher Pix, o código para pagar aparece depois que você enviar o pedido."
        : "Toque em Cartão ou Dinheiro. Você acerta o pagamento com o atendente.",
      target: "#cust-payment",
      view: "cart",
    },
    {
      id: "enviar",
      title: "Envie o pedido",
      text:
        "Quando estiver tudo certo, toque em Enviar pedido. " +
        "A cozinha recebe na hora e você acompanha o andamento aqui na tela.",
      target: "#cust-send",
      view: "cart",
      advanceOnClick: true,
    }
  );

  return steps;
}

/**
 * Paying a Pix code: copy it, paste it in the bank app, wait for the restaurant
 * to confirm. Targets exist on the order slip while a Pix code is waiting.
 */
export function pixTour(): TourStep[] {
  return [
    {
      id: "pix-copiar",
      title: "Copie o código Pix",
      text: "Toque em Copiar código Pix. O código já tem o valor certo do seu pedido.",
      target: "#cust-pix-copy",
      advanceOnClick: true,
    },
    {
      id: "pix-banco",
      title: "Pague no app do seu banco",
      text:
        "Abra o app do seu banco e escolha Pix, depois Pix Copia e Cola. " +
        "Cole o código, confira o valor e o nome do recebedor e confirme.",
    },
    {
      id: "pix-confirmacao",
      title: "Espere a confirmação",
      text: "Depois que você pagar, o restaurante confirma. Aqui aparece Pagamento recebido.",
      target: "#cust-pix-status",
    },
  ];
}
