/**
 * Achar o prato que a pessoa falou, igual para o dono (marcar esgotado) e para o cliente (pedir). Só conta, sem React
 * nem rede: tests/novo/voiceDishLogic.test.mjs e shopVoiceLogic.test.mjs rodam isto no Node.
 *
 * As regras são as mesmas dos dois lados e não mudam por quem fala:
 *  - só vale se **todas** as palavras ditas estão no nome do prato (acento e plural não atrapalham);
 *  - **não adivinha**: mais de um prato com a palavra vira a lista de nomes, e quem chama pede o nome inteiro; só quando
 *    a pessoa falou o nome de um deles por inteiro, esse é o escolhido;
 *  - palavra que não está em prato nenhum é "nenhum prato", nunca o parecido.
 */

/** O que a busca precisa de um prato: o código e o nome. O resto do prato fica com quem chama. */
export type NamedDish = { id: string; name: string };

/**
 * Palavras que só enchem a frase: não ajudam a achar o prato. Valem **iguais** para a fala e para o nome do prato (se
 * fossem listas diferentes, "xis tudo" falaria uma palavra que o nome do prato perdeu). Aqui entram os jeitos de pedir
 * ("quero", "me vê", "põe"), os de marcar ("acabou" fica fora: é do painel) e as palavras de cardápio.
 */
const FILLER = new Set(
  (
    "o a os as um uma uns umas de do da dos das no na nos nas pra para por pelo pela que e meu minha nosso nossa ja mais tudo hoje agora aqui " +
    "favor gente ai novo novamente pode poderia posso quero queria queremos gostaria vou me ve manda mandar traz trazer poe poem bota botar adiciona adicionar pedir " +
    "tem temos ok vem marca marcar marque como coloca colocar deixa deixar tira tirar remove remover retira retirar esse essa isso prato pratos " +
    "produto produtos item cardapio lista pessoal esta estao foi sao ta sacola carrinho ver veja mostra mostrar abrir abre abra"
  ).split(" "),
);

/** Minúsculas e sem acento. */
export const plain = (text: string): string =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** As palavras que ajudam a achar o prato: sem acento, sem as que só enchem a frase. */
export const wordsOf = (text: string): string[] =>
  plain(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "" && !FILLER.has(word));

/** Plural de quem fala ("pastéis", "limões") para o singular do cardápio ("pastel", "limao"). */
function stem(word: string): string {
  if (word.length > 4 && /(oes|aes)$/.test(word)) return `${word.slice(0, -3)}ao`;
  if (word.length > 4 && /eis$/.test(word)) return `${word.slice(0, -3)}el`;
  if (word.length > 4 && /ois$/.test(word)) return `${word.slice(0, -3)}ol`;
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Duas palavras são a mesma: iguais, uma começa a outra (de 3 letras para cima) ou o plural de uma é a outra. */
function sameWord(said: string, name: string): boolean {
  if (said === name) return true;
  if (said.length >= 3 && name.length >= 3 && (said.startsWith(name) || name.startsWith(said))) return true;
  return stem(said) === stem(name);
}

export type DishFound<T extends NamedDish = NamedDish> =
  | { kind: "one"; dish: T }
  | { kind: "many"; names: string[] }
  | { kind: "none" };

/** Acha o prato que a pessoa falou. Só vale se todas as palavras dela estão no nome; no empate não adivinha. */
export function findDish<T extends NamedDish>(products: readonly T[], words: readonly string[]): DishFound<T> {
  const said = words.map(plain);
  if (said.length === 0) return { kind: "none" };
  const candidates = products
    .map((dish) => ({ dish, named: wordsOf(dish.name) }))
    .filter(({ named }) => named.length > 0 && said.every((word) => named.some((name) => sameWord(word, name))));
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1) return { kind: "one", dish: candidates[0].dish };
  // Vários: vale o que a pessoa falou inteiro (todas as palavras do nome foram ditas), se for um só.
  const whole = candidates.filter(({ named }) => named.every((name) => said.some((word) => sameWord(word, name))));
  if (whole.length === 1) return { kind: "one", dish: whole[0].dish };
  const names = [...new Set(candidates.map(({ dish }) => dish.name))];
  return { kind: "many", names };
}

/** "A, B ou C" (no máximo três nomes; com mais, diz quantos faltam). */
export function namesText(names: readonly string[]): string {
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} e mais ${extra}`;
  return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} ou ${shown[shown.length - 1]}`;
}
