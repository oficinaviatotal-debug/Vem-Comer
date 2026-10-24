/**
 * Como a fala é lida, igual em todas as telas que escutam (painel e cliente). Só conta, sem React nem rede.
 *
 * O que a pessoa disse vira letras minúsculas, sem acento e sem pontuação, com um espaço antes e outro depois: assim
 * " pedidos " só casa com a palavra inteira (e "mesa" não casa dentro de "mesada").
 */
export function normalizeSpeech(text: string | null | undefined): string {
  const plain = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${plain} `;
}

/** Quanto tempo a resposta fica na tela: o tempo de ler, com um mínimo (8 s) e um máximo (20 s). */
export function captionMs(text: string): number {
  const read = String(text ?? "").length * 70;
  return Math.max(8000, Math.min(20000, read));
}
