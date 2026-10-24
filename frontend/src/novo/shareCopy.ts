/**
 * As frases que o dono manda aos clientes (mensagem do WhatsApp e texto que vai junto com o cartão de um prato).
 *
 * Mesmo motor das frases da voz (`phrasing.ts`): cada situação tem várias formas de dizer a mesma coisa, saem sem repetir, e
 * a PRIMEIRA é a de referência. A mensagem que o dono vê primeiro é sempre a de referência (a mesma da tela antiga); quando
 * ele toca em "Outra mensagem", vêm as outras. Assim o texto que chega aos clientes não fica igual para sempre, e a
 * mensagem não vira "propaganda repetida" no grupo.
 *
 * Regras de escrita (o teste tests/novo/shareLogic.test.mjs confere):
 *  - português simples, frase curta, sem palavra difícil nem de inglês nem de informática;
 *  - nada de grito (sem "!"), nada de promessa que o sistema não sabe (hoje, agora, desconto, grátis, o melhor);
 *  - todas as formas dizem a mesma coisa: abra o cardápio pelo celular e peça. O que muda é o jeito, nunca o fato;
 *  - o link vem sempre numa linha só dele, depois do texto (quem monta a mensagem junta; aqui só mora o texto).
 *
 * COMO MANTER FRESCAS: a cada ~2 meses, ler as formas em voz alta; trocar a que cansa; mexer em `PHRASES_REVIEWED` de
 * `voiceCopy.ts` (a mesma data vale para estas frases).
 */
import { bank, type Bank } from "./phrasing.ts";

/** A mensagem pronta quando o restaurante tem nome. A primeira forma é a da tela antiga. */
export const SHARE_SAY_MESSAGE = bank<[string]>("divulgar.mensagem", {
  full: [
    (name) => `${name}: veja o cardápio e faça o seu pedido pelo celular.`,
    (name) => `Cardápio de ${name} no celular: escolha o que quer e envie o pedido.`,
    (name) => `Com fome? O cardápio de ${name} está aqui, sem baixar nada.`,
    (name) => `Peça em ${name} pelo celular: abra o cardápio, escolha e envie.`,
    (name) => `Quer pedir em ${name}? O cardápio está aqui, é só escolher e enviar.`,
  ],
});

/** E quando o restaurante ainda não tem nome cadastrado. */
export const SHARE_SAY_MESSAGE_NO_NAME = bank("divulgar.mensagem-sem-nome", {
  full: [
    "Veja o cardápio e faça o seu pedido pelo celular.",
    "O nosso cardápio no celular: escolha o que quer e envie o pedido.",
    "Com fome? O cardápio está aqui, sem baixar nada.",
    "Peça pelo celular: abra o cardápio, escolha e envie.",
    "Quer pedir? O cardápio está aqui, é só escolher e enviar.",
  ],
});

/** O texto que vai junto com o cartão de um prato: o prato e o preço (os dois vêm do cadastro, nunca inventados). */
export const SHARE_SAY_CAPTION = bank<[string, string]>("divulgar.legenda", {
  full: [
    (dish, price) => `${dish} por ${price}. Peça pelo celular.`,
    (dish, price) => `Experimente ${dish}, por ${price}. Veja o cardápio e peça.`,
    (dish, price) => `${dish}: ${price}. É só abrir o cardápio, escolher e enviar o pedido.`,
    (dish, price) => `Que tal ${dish}? Sai por ${price}, direto do cardápio no celular.`,
    (dish, price) => `${dish} por ${price}. O cardápio inteiro está no link.`,
  ],
});

/** Todas as situações deste arquivo, com exemplos de dados, para o teste conferir a escrita de cada forma. */
export const SHARE_BANKS: ReadonlyArray<{ bank: Bank<never[]>; samples: ReadonlyArray<readonly unknown[]> }> = [
  { bank: SHARE_SAY_MESSAGE as unknown as Bank<never[]>, samples: [["Padaria Boa Massa"], ["Casa da Maria"]] },
  { bank: SHARE_SAY_MESSAGE_NO_NAME as unknown as Bank<never[]>, samples: [[]] },
  { bank: SHARE_SAY_CAPTION as unknown as Bank<never[]>, samples: [["Pastel de carne", "R$ 9,00"], ["Açaí de 500 ml", "R$ 18,50"]] },
];
