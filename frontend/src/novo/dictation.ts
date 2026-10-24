/**
 * O texto que vai para o campo quando a pessoa fala. Só conta, sem React nem microfone:
 * tests/novo/dictation.test.mjs roda isto no Node.
 *
 * O reconhecimento de voz entrega a frase como ouviu: às vezes com ponto no fim, às vezes em letra minúscula, com
 * espaços sobrando. Aqui ela fica como alguém escreveria num campo de nome ou de busca. **Nada é inventado nem
 * "corrigido"**: as palavras são as que o celular ouviu (a pessoa vê o campo e pode corrigir à mão).
 */

/** "pastel de carne." -> "Pastel de carne". Respeita o limite do campo (`max`), sem deixar espaço na ponta. */
export function fitDictation(words: string | null | undefined, max?: number): string {
  let text = String(words ?? "")
    .replace(/\s+/g, " ")
    .trim()
    // O ponto final do reconhecimento não faz parte de um nome nem de uma busca.
    .replace(/[.,;:!?…\s]+$/u, "");
  if (text === "") return "";
  text = text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
  if (typeof max === "number" && Number.isFinite(max) && max > 0 && text.length > max) text = text.slice(0, Math.floor(max)).trimEnd();
  return text;
}

/**
 * Para campo de várias linhas (as opções do prato): o que a pessoa fala vai **depois** do que já está escrito, com um
 * espaço no meio (ela fala aos poucos). Campo vazio: igual a `fitDictation`. Respeita o limite do campo.
 */
export function joinDictation(current: string | null | undefined, words: string | null | undefined, max?: number): string {
  const before = String(current ?? "").trimEnd();
  const piece = fitDictation(words);
  if (piece === "") return before;
  if (before === "") return fitDictation(words, max);
  // No meio de um texto a frase não começa em maiúscula.
  const joined = `${before} ${piece.charAt(0).toLocaleLowerCase("pt-BR")}${piece.slice(1)}`;
  return typeof max === "number" && Number.isFinite(max) && max > 0 && joined.length > max ? joined.slice(0, Math.floor(max)).trimEnd() : joined;
}
