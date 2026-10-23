/**
 * As frases da bolinha de voz e do "como está o dia?", com várias formas de dizer cada coisa.
 *
 * É o lugar único onde elas moram: para trocar, tirar ou pôr uma forma, mexe-se só aqui (o motor está em `phrasing.ts`).
 * Como o motor funciona: a PRIMEIRA forma de cada lista é a de referência; as outras entram no sorteio sem repetir
 * (ver `phrasing.ts`). Cada forma tem de dizer **a mesma coisa** que as outras: o que muda é o jeito, nunca o fato.
 *
 * Regras de escrita (o teste tests/novo/phrasing.test.mjs confere):
 *  - português simples, frase curta, sem palavra difícil nem de inglês nem de informática;
 *  - nome de botão e instrução de como fazer não variam: "Fechar", "Tentar de novo", "toque no menu" saem iguais;
 *  - depois de "Não consegui…" vem o que a pessoa pode fazer, ou a frase fica só no fato (nunca culpa a pessoa);
 *  - a forma curta (`short`) diz menos, nunca diz outra coisa.
 *
 * COMO MANTER FRESCAS (a cada ~2 meses, ou quando entra uma tela nova): ler cada lista em voz alta; trocar a forma que
 * já cansa ou que fala de algo que mudou; conferir se as telas novas estão em `painel/voiceNavLogic.ts` (os exemplos
 * saem das telas que o menu mostra, então já acompanham sozinhos); e mexer em `PHRASES_REVIEWED` abaixo.
 */
import { bank, type Bank, type Moment } from "./phrasing.ts";

/** Dia da última revisão das frases (AAAA-MM-DD). Quem revisar muda aqui. */
export const PHRASES_REVIEWED = "2026-10-23";

const pedidos = (count: number): string => (count === 1 ? "pedido" : "pedidos");

// ---------------------------------------------------------------- a bolinha de voz (ir para uma tela falando)

export const SAY_LISTENING = bank("voz.ouvindo", {
  full: [
    "Estou ouvindo. Diga a tela que você quer abrir.",
    "Pode falar. Diga qual tela você quer abrir.",
    "Estou aqui. Diga o nome da tela que você quer.",
    "Pode falar: qual tela você quer abrir?",
  ],
  short: ["Estou ouvindo.", "Pode falar.", "Fale agora.", "Diga."],
});

export const SAY_NOT_HEARD = bank("voz.nao-ouvi", {
  full: [
    "Não ouvi nada. Toque na bolinha e fale de novo. Se o celular pedir o microfone, toque em Permitir.",
    "Não consegui ouvir. Toque na bolinha e fale de novo. Se aparecer um pedido de microfone, toque em Permitir.",
    "Silêncio por aqui. Toque na bolinha e fale de novo; se o celular pedir o microfone, toque em Permitir.",
  ],
  short: ["Não ouvi nada. Toque e fale de novo.", "Não peguei nada. Tente de novo.", "Não ouvi. Fale mais perto do celular."],
  after: 2,
});

export const SAY_NO_VOICE = bank("voz.sem-voz", {
  full: [
    "Este celular não escuta por aqui. Use o menu no alto da tela.",
    "A voz não funciona neste celular. Toque no menu, no alto da tela.",
    "Aqui o celular não deixa eu ouvir. Use o menu no alto da tela.",
  ],
  short: ["Sem voz neste celular. Use o menu.", "O celular não escuta aqui. Use o menu.", "Aqui não dá para falar. Use o menu."],
  after: 2,
});

export const SAY_OPENING = bank<[string]>("voz.abrindo", {
  full: [(what) => `Abrindo ${what}.`, (what) => `Abrindo ${what} agora.`, (what) => `Certo, abrindo ${what}.`, (what) => `Vamos para ${what}.`, (what) => `Indo para ${what}.`],
});

export const SAY_HERE = bank<[string]>("voz.ja-aqui", {
  full: [(where) => `Você já está ${where}.`, (where) => `Já estamos ${where}.`, (where) => `Você está ${where} agora.`],
});

export const SAY_BLOCKED = bank<[string]>("voz.nao-pode", {
  full: [
    (what) => `Não posso abrir ${what} para você agora. Toque no menu para ver o que está liberado.`,
    (what) => `Seu acesso não abre ${what}. Toque no menu para ver o que está liberado.`,
    (what) => `Não posso abrir ${what} para você. Veja no menu o que está liberado.`,
  ],
  short: [(what) => `Não posso abrir ${what} para você.`, (what) => `Seu acesso não abre ${what}.`, (what) => `Não dá para abrir ${what} com o seu acesso.`],
});

export const SAY_UNKNOWN = bank<[string]>("voz.nao-entendi", {
  full: [
    (examples) => `Não entendi. Diga, por exemplo: ${examples}.`,
    (examples) => `Não peguei essa. Tente dizer: ${examples}.`,
    (examples) => `Hum, não entendi. Experimente: ${examples}.`,
    (examples) => `Não entendi bem. Que tal dizer: ${examples}?`,
  ],
  short: [(examples) => `Não entendi. Tente: ${examples}.`, (examples) => `Não peguei. Diga: ${examples}.`, (examples) => `Não entendi. Por exemplo: ${examples}.`],
});

export const SAY_HELP = bank<[string]>("voz.ajuda", {
  full: [
    (examples) => `Você pode dizer: ${examples}. Para ver todas as telas, toque no menu.`,
    (examples) => `Diga o nome da tela, por exemplo: ${examples}. O menu mostra todas.`,
    (examples) => `Eu abro as telas pelo nome: ${examples}. Também pode perguntar: como está o dia?`,
  ],
});

export const SAY_NO_EXAMPLES = bank("voz.sem-exemplos", {
  full: [
    "Toque no menu, no alto da tela, para escolher uma tela.",
    "Use o menu, no alto da tela, para escolher a tela.",
    "Para escolher uma tela, toque no menu, no alto.",
  ],
});

// ---------------------------------------------------------------- o microfone ao lado de um campo de escrever

export const SAY_DICTATE_LISTENING = bank("voz.ditar.ouvindo", {
  full: ["Estou ouvindo. Fale o que você quer escrever.", "Pode falar. Eu escrevo no campo.", "Estou aqui. Diga o que escrever."],
  short: ["Pode falar.", "Estou ouvindo.", "Fale agora."],
});

export const SAY_DICTATE_NOT_HEARD = bank("voz.ditar.nao-ouvi", {
  full: [
    "Não ouvi nada. Toque no microfone do campo e fale de novo. Se o celular pedir o microfone, toque em Permitir.",
    "Não consegui ouvir. Toque no microfone do campo e fale de novo. Se aparecer um pedido de microfone, toque em Permitir.",
    "Silêncio por aqui. Toque no microfone do campo e fale de novo; se o celular pedir o microfone, toque em Permitir.",
  ],
  short: ["Não ouvi nada. Toque no microfone e fale de novo.", "Não peguei nada. Tente de novo.", "Não ouvi. Fale mais perto do celular."],
  after: 2,
});

export const SAY_DICTATE_OFF = bank("voz.ditar.sem-voz", {
  full: ["Este celular não escuta por aqui. Escreva no campo.", "A voz não funciona neste celular. Escreva no campo.", "Aqui o celular não deixa eu ouvir. Escreva no campo."],
});

/** O que a pessoa ouve de volta depois de ditar. A palavra é a que foi escrita no campo, igual. */
export const SAY_DICTATED = bank<[string]>("voz.ditar.escrevi", {
  full: [(words) => `Escrevi: ${words}.`, (words) => `Anotei: ${words}.`, (words) => `Ficou assim: ${words}.`],
});

// ---------------------------------------------------------------- "como está o dia?": o que a bolinha lê em voz alta

export const SAY_BRIEF_WAIT = bank("dia.espera", {
  full: ["Olhando como está o dia…", "Vendo como está o dia…", "Conferindo o dia…", "Um instante, estou olhando o dia…"],
});

export const SAY_BRIEF_FAIL = bank("dia.falhou", {
  full: [
    "Não consegui ver como está o dia agora. Confira a internet e pergunte de novo.",
    "O dia não carregou agora. Confira a internet e pergunte de novo.",
    "Não consegui olhar o dia agora. Veja a internet e peça de novo.",
  ],
});

export const SAY_BRIEF_NO_ORDERS = bank("dia.sem-pedidos-lidos", {
  full: ["Não consegui ler os pedidos agora.", "Os pedidos não carregaram agora.", "Não consegui ver os pedidos agora."],
});

export const SAY_BRIEF_NO_CALLS = bank("dia.sem-mesas-lidas", {
  full: ["Não consegui ver as mesas chamando agora.", "Não consegui ver se há mesa chamando agora.", "Não consegui conferir as chamadas das mesas agora."],
});

export const SAY_BRIEF_NO_SALES = bank("dia.sem-vendas-lidas", {
  full: ["Não consegui ler as vendas agora.", "As vendas não carregaram agora.", "Não consegui ver as vendas agora."],
});

/** "Bom dia, João" e o dia da semana ("sexta-feira"): a abertura do resumo. */
export const SAY_BRIEF_GREETING = bank<[string, string]>("dia.saudacao", {
  full: [
    (hello) => `${hello}.`,
    (hello, weekday) => `${hello}. Hoje é ${weekday}.`,
    (hello) => `${hello}. Vamos ver como está o dia.`,
  ],
  short: [(hello) => `${hello}.`, (hello, weekday) => `${hello}. Hoje é ${weekday}.`],
});

export const SAY_BRIEF_NONE_WAITING = bank("dia.nenhum-esperando", {
  full: ["Nenhum pedido esperando.", "Nenhum pedido na fila.", "Nada esperando agora.", "Fila de pedidos vazia."],
});

export const SAY_BRIEF_WAITING = bank<[number, string]>("dia.esperando", {
  full: [
    (count, oldest) => `${count} ${count === 1 ? "pedido esperando" : "pedidos esperando"}${oldest ? `, o mais antigo há ${oldest}` : ""}.`,
    (count, oldest) => `Tem ${count} ${pedidos(count)} esperando${oldest ? `; o mais antigo espera há ${oldest}` : ""}.`,
    (count, oldest) => `${count} ${pedidos(count)} na fila${oldest ? `, o mais antigo há ${oldest}` : ""}.`,
  ],
});

/** Quando o mais antigo já passa de 20 minutos (a cor vermelha da comanda): a fala puxa a atenção, em vez de só contar. */
export const SAY_BRIEF_LATE = bank<[number, string]>("dia.atrasado", {
  full: [
    (count, oldest) => `Atenção: ${count} ${pedidos(count)} esperando, o mais antigo há ${oldest}.`,
    (count, oldest) =>
      count === 1 ? `Tem um pedido esperando há bastante tempo: ${oldest}.` : `Tem pedido esperando há bastante tempo: ${count} na fila, o mais antigo há ${oldest}.`,
    (count, oldest) => `Veja os pedidos primeiro: ${count} esperando, o mais antigo há ${oldest}.`,
  ],
});

export const SAY_BRIEF_COOKING = bank<[number]>("dia.cozinha", {
  full: [(count) => `${count} na cozinha.`, (count) => `Na cozinha: ${count}.`, (count) => (count === 1 ? "1 está na cozinha." : `${count} estão na cozinha.`)],
});

export const SAY_BRIEF_ON_THE_WAY = bank<[number]>("dia.a-caminho", {
  full: [(count) => `${count} a caminho.`, (count) => (count === 1 ? "1 já saiu para entrega." : `${count} já saíram para entrega.`), (count) => `A caminho do cliente: ${count}.`],
});

const SALES_FORMS: Record<Moment, Bank<[string, number]>> = {
  manha: bank("dia.vendas.manha", {
    full: [
      (money, count) => `Vendas de hoje: ${money} em ${count} ${pedidos(count)}.`,
      (money, count) => `Hoje já são ${money} em ${count} ${pedidos(count)}.`,
      (money, count) => `Até agora, ${money} em ${count} ${pedidos(count)}.`,
    ],
  }),
  tarde: bank("dia.vendas.tarde", {
    full: [
      (money, count) => `Vendas de hoje: ${money} em ${count} ${pedidos(count)}.`,
      (money, count) => `Até agora hoje: ${money} em ${count} ${pedidos(count)}.`,
      (money, count) => `O dia está em ${money}, com ${count} ${pedidos(count)}.`,
    ],
  }),
  noite: bank("dia.vendas.noite", {
    full: [
      (money, count) => `Vendas de hoje: ${money} em ${count} ${pedidos(count)}.`,
      (money, count) => `No dia, ${money} em ${count} ${pedidos(count)}.`,
      (money, count) => `O dia está em ${money}, com ${count} ${pedidos(count)}.`,
    ],
  }),
};

/** As vendas do dia, com o jeito de falar da hora (de manhã "até agora", à noite "no dia"). */
export function salesBankFor(moment: Moment): Bank<[string, number]> {
  return SALES_FORMS[moment];
}

const NO_SALES_EARLY = bank("dia.sem-vendas.manha", {
  full: ["Ainda sem vendas hoje.", "O dia está começando: ainda sem vendas.", "Ainda não teve venda hoje."],
});
const NO_SALES_LATER = bank("dia.sem-vendas.depois", {
  full: ["Ainda sem vendas hoje.", "Hoje ainda não teve venda.", "Nenhuma venda hoje até agora."],
});
const NO_SALES_FORMS: Record<Moment, Bank> = { manha: NO_SALES_EARLY, tarde: NO_SALES_LATER, noite: NO_SALES_LATER };

/** "Ainda sem vendas": de manhã o dia está começando; depois do meio-dia a frase não promete nada. */
export function noSalesBankFor(moment: Moment): Bank {
  return NO_SALES_FORMS[moment];
}

/** O empurrão no fim do resumo (só enquanto a pessoa ainda está aprendendo; depois de 3 vezes some). */
export const SAY_BRIEF_HINT_ORDERS = bank("dia.dica-pedidos", {
  full: ["Para abrir, diga pedidos.", "Quer ver? Diga pedidos.", "Diga pedidos e eu abro."],
  short: [],
});

/** Todas as listas, com dados de exemplo, para o teste conferir a escrita de cada forma. */
export type Registered = { bank: Bank<unknown[]>; samples: unknown[][] };

function entry<A extends unknown[]>(spec: Bank<A>, ...samples: A[]): Registered {
  return { bank: spec as unknown as Bank<unknown[]>, samples: samples.length > 0 ? samples : [[] as unknown as A] };
}

export const ALL_BANKS: readonly Registered[] = [
  entry(SAY_LISTENING),
  entry(SAY_NOT_HEARD),
  entry(SAY_NO_VOICE),
  entry(SAY_OPENING, ["os pedidos"], ["a fila da cozinha"], ["o Hoje"]),
  entry(SAY_HERE, ["nos pedidos"], ["no Hoje"], ["na fila da cozinha"]),
  entry(SAY_BLOCKED, ["os custos"], ["a equipe"]),
  entry(SAY_UNKNOWN, ["pedidos, abrir mesa ou mesas"], ["pedidos"]),
  entry(SAY_HELP, ["pedidos, abrir mesa ou mesas"], ["pedidos"]),
  entry(SAY_NO_EXAMPLES),
  entry(SAY_DICTATE_LISTENING),
  entry(SAY_DICTATE_NOT_HEARD),
  entry(SAY_DICTATE_OFF),
  entry(SAY_DICTATED, ["Pastel de carne"], ["Sem cebola"]),
  entry(SAY_BRIEF_WAIT),
  entry(SAY_BRIEF_FAIL),
  entry(SAY_BRIEF_NO_ORDERS),
  entry(SAY_BRIEF_NO_CALLS),
  entry(SAY_BRIEF_NO_SALES),
  entry(SAY_BRIEF_GREETING, ["Bom dia, João", "sexta-feira"], ["Boa noite", "domingo"]),
  entry(SAY_BRIEF_NONE_WAITING),
  entry(SAY_BRIEF_WAITING, [1, "1 minuto"], [3, "12 minutos"], [2, ""]),
  entry(SAY_BRIEF_LATE, [1, "25 minutos"], [4, "1 hora e 5 minutos"]),
  entry(SAY_BRIEF_COOKING, [1], [5]),
  entry(SAY_BRIEF_ON_THE_WAY, [1], [2]),
  entry(SALES_FORMS.manha, ["R$ 42,50", 1], ["R$ 1.284,50", 38]),
  entry(SALES_FORMS.tarde, ["R$ 42,50", 1], ["R$ 1.284,50", 38]),
  entry(SALES_FORMS.noite, ["R$ 42,50", 1], ["R$ 1.284,50", 38]),
  entry(NO_SALES_EARLY),
  entry(NO_SALES_LATER),
  entry(SAY_BRIEF_HINT_ORDERS),
];
