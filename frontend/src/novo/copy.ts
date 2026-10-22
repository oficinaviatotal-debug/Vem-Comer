/**
 * Frases fixas do acompanhamento e do Pix, num só lugar: a tela (novo/Tracking.tsx) e a conta (loja/trackingLogic.ts)
 * leem daqui, então a frase que o teste confere é a que a pessoa lê. Só texto: nada daqui depende de React nem de rede.
 */

export const OFFLINE_NOTE = "Sem internet. Mostrando o último andamento.";

export const PIX_STEPS = [
  "Abra o app do seu banco e escolha Pix, depois Pix Copia e Cola.",
  "Cole o código, confira o valor e o nome do recebedor e pague.",
] as const;
export const PIX_ERROR_TEXT = "Não deu para mostrar o código agora. Confira a internet.";
export const PIX_MISSING_TEXT = "Você acerta o pagamento com o atendente.";
export const PIX_AFTER_TEXT = "Depois de pagar, o restaurante confirma e aqui aparece Pagamento recebido.";
export const PIX_COPIED_TEXT = "Código copiado. Agora cole no app do seu banco.";
export const PIX_COPY_MANUAL_TEXT = "Não deu para copiar sozinho. Toque e segure no código abaixo para copiar.";

/** A frase que acompanha o resultado do toque em "Copiar código Pix" (vazio: ainda não tocou). */
export const copiedText = (copied: "" | "ok" | "manual"): string =>
  copied === "ok" ? PIX_COPIED_TEXT : copied === "manual" ? PIX_COPY_MANUAL_TEXT : "";

export const RATING_THANKS = "Obrigado pela sua avaliação!";
