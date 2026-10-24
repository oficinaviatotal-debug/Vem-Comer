/**
 * As frases da tela "Vendas" (o painel do dono do sistema): os rascunhos que ele manda a donos de restaurante e os textos
 * da tela. Nada é enviado por aqui: a pessoa do Vem lê, ajusta, manda ela mesma e toca em "Já mandei".
 *
 * Os rascunhos usam o mesmo motor das frases da voz (`phrasing.ts`): cada situação tem várias formas de dizer a mesma
 * coisa, que saem sem repetir, e a PRIMEIRA é a de referência. Assim a mesma pessoa não recebe, de um negócio ao outro,
 * o mesmo texto de propaganda copiado, e as mensagens não envelhecem.
 *
 * Regras de escrita (tests/novo/vendasLogic.test.mjs confere cada forma, com exemplos):
 *  - **quem fala**: toda primeira mensagem e todo lembrete dizem que é da Vem Tecnologia;
 *  - **de onde veio o contato**: a primeira mensagem diz onde o contato foi visto (é a regra do caderno de vendas);
 *  - **como parar**: a primeira mensagem, o lembrete e o e-mail dizem "responda NÃO" (e o Vem para, para sempre);
 *  - nada de preço, desconto, grátis, garantia, "o melhor", pressa nem número inventado: o Vem não promete o que não sabe;
 *  - português simples, frase curta, sem grito (nenhum "!") e sem palavra difícil.
 *
 * COMO MANTER FRESCAS: a cada ~2 meses, ler as formas em voz alta; trocar a que cansa; mexer em `PHRASES_REVIEWED` de
 * `voiceCopy.ts` (a mesma data vale para estas frases).
 */
import { bank, type Bank } from "./phrasing.ts";

// ---------------------------------------------------------------- os rascunhos

/** O cumprimento, com o nome da pessoa do negócio quando a ficha tem. */
export const SALES_SAY_HELLO = bank<[string]>("vendas.ola", {
  full: [(person) => `Olá, ${person}.`, (person) => `Oi, ${person}, tudo bem?`, (person) => `Olá, ${person}, tudo bem?`],
});

/** E quando a ficha não tem o nome da pessoa. */
export const SALES_SAY_HELLO_NO_NAME = bank("vendas.ola-sem-nome", {
  full: ["Olá.", "Olá, tudo bem?", "Oi, tudo bem?"],
});

/** Quem fala, com o nome de quem manda. */
export const SALES_SAY_WHO = bank<[string]>("vendas.quem", {
  full: [
    (sender) => `Aqui é ${sender}, da Vem Tecnologia.`,
    (sender) => `Sou ${sender}, da Vem Tecnologia.`,
    (sender) => `Meu nome é ${sender}, da Vem Tecnologia.`,
  ],
});

/** E quando quem manda ainda não disse o nome. */
export const SALES_SAY_WHO_NO_NAME = bank("vendas.quem-sem-nome", {
  full: ["Aqui é da Vem Tecnologia.", "Escrevo em nome da Vem Tecnologia.", "Falo pela Vem Tecnologia."],
});

/** De onde veio o contato, por origem (as mesmas origens do caderno do servidor). O argumento é o nome do negócio. */
export const SALES_SAY_ORIGIN: Record<string, Bank<[string]>> = {
  anuncio_publico: bank<[string]>("vendas.origem.anuncio", {
    full: [
      (name) => `Encontrei o contato de vocês (${name}) no anúncio que vocês mesmos divulgaram.`,
      (name) => `Vi o anúncio de ${name} e anotei o contato que vocês divulgaram.`,
      (name) => `O contato de vocês (${name}) estava no anúncio que vocês divulgaram, por isso escrevo.`,
    ],
  }),
  site_da_empresa: bank<[string]>("vendas.origem.site", {
    full: [
      (name) => `Encontrei o contato de vocês (${name}) no site de vocês.`,
      (name) => `O contato de vocês (${name}) estava no site de vocês, por isso escrevo.`,
      (name) => `Vi o site de ${name} e anotei o contato que vocês divulgam lá.`,
    ],
  }),
  indicacao: bank<[string]>("vendas.origem.indicacao", {
    full: [
      (name) => `O contato de vocês (${name}) chegou até mim por indicação.`,
      (name) => `Alguém indicou o contato de vocês (${name}) para eu escrever.`,
      (name) => `Recebi por indicação o contato de vocês (${name}).`,
    ],
  }),
  parceiro: bank<[string]>("vendas.origem.parceiro", {
    full: [
      (name) => `O contato de vocês (${name}) chegou até mim por um parceiro da Vem Tecnologia.`,
      (name) => `Um parceiro da Vem Tecnologia passou o contato de vocês (${name}).`,
      (name) => `Recebi de um parceiro o contato de vocês (${name}).`,
    ],
  }),
  pedido_do_contato: bank<[string]>("vendas.origem.pedido", {
    full: [
      (name) => `Vocês pediram que a Vem Tecnologia entrasse em contato com ${name}.`,
      (name) => `Escrevo porque vocês (${name}) pediram para a Vem Tecnologia entrar em contato.`,
      (name) => `Vocês (${name}) pediram contato com a Vem Tecnologia, por isso escrevo.`,
    ],
  }),
  visita: bank<[string]>("vendas.origem.visita", {
    full: [
      (name) => `Estive aí em ${name} e anotei o contato para continuar a conversa.`,
      (name) => `Passei por ${name} e anotei o contato de vocês para escrever depois.`,
      (name) => `Escrevo depois de passar por ${name}, onde anotei o contato de vocês.`,
    ],
  }),
  formulario_do_site: bank<[string]>("vendas.origem.formulario", {
    full: [
      (name) => `Você deixou o contato de ${name} no nosso site, pedindo que a gente falasse com você. Se não foi você, me avise.`,
      (name) => `Escrevo porque o contato de ${name} foi deixado no nosso site, com o pedido de que a gente falasse. Se não foi você, me avise.`,
      (name) => `O contato de ${name} foi deixado no nosso site pedindo que a gente falasse. Se não foi você, é só me dizer.`,
    ],
  }),
};

/** O que é o Vem Comer, em uma frase, sem prometer resultado. */
export const SALES_SAY_WHAT = bank("vendas.o-que-e", {
  full: [
    "O Vem Comer é um sistema de cardápio e pedidos pelo celular para quem vende comida.",
    "O Vem Comer coloca o cardápio no celular do cliente e leva o pedido para o painel do restaurante.",
    "Com o Vem Comer, o cliente vê o cardápio e faz o pedido pelo celular, e o negócio recebe tudo em um painel.",
  ],
});

/** O convite: mostrar, sem pressa. */
export const SALES_SAY_ASK = bank("vendas.convite", {
  full: [
    "Posso mostrar como funciona em poucos minutos?",
    "Posso te mostrar como funciona? Leva poucos minutos.",
    "Se fizer sentido para vocês, mostro como funciona em poucos minutos.",
  ],
});

/** Como parar. Todas as formas dizem a mesma coisa: responder NÃO. */
export const SALES_SAY_STOP = bank("vendas.parar", {
  full: [
    "Se não quiser receber mais mensagens, responda NÃO e eu paro na hora.",
    "Para eu não escrever mais, é só responder NÃO.",
    "Se preferir não receber mais nada, responda NÃO e eu não escrevo de novo.",
  ],
});

/** O mesmo, para o e-mail. */
export const SALES_SAY_STOP_EMAIL = bank("vendas.parar-email", {
  full: [
    "Para não receber mais mensagens, responda este e-mail com a palavra NÃO e eu paro na hora.",
    "Se não quiser mais e-mails meus, responda com a palavra NÃO e eu não escrevo de novo.",
  ],
});

/** O lembrete, depois de alguns dias sem resposta. */
export const SALES_SAY_REMIND = bank("vendas.lembrete", {
  full: [
    "Mandei uma mensagem há alguns dias sobre o Vem Comer, o sistema de cardápio e pedidos pelo celular. Passo só para ver se chegou.",
    "Passo para retomar a mensagem de alguns dias atrás sobre o Vem Comer: cardápio e pedidos pelo celular.",
    "Voltei a escrever sobre o Vem Comer, o cardápio e os pedidos pelo celular, caso a mensagem anterior tenha passado.",
  ],
});

/** O lembrete não cobra: deixa a saída aberta. */
export const SALES_SAY_REMIND_EASY = bank("vendas.lembrete-saida", {
  full: ["Se agora não for o momento, tudo bem.", "Se não for o momento, sem problema.", "Se não fizer sentido para vocês, é só me dizer."],
});

/** Responder a quem respondeu com interesse. */
export const SALES_SAY_REPLY_INTERESTED = bank("vendas.resposta.interesse", {
  full: [
    "Obrigado pelo retorno. Posso mostrar como o Vem Comer funciona em poucos minutos. Qual horário é bom para você?",
    "Que bom ter o seu retorno. Mostro como o Vem Comer funciona em poucos minutos. Qual horário fica bom para você?",
    "Obrigado por responder. Posso te mostrar o Vem Comer funcionando, em poucos minutos. Qual horário fica bom para você?",
  ],
});

/** Responder a quem tem uma dúvida. */
export const SALES_SAY_REPLY_DOUBT = bank("vendas.resposta.duvida", {
  full: [
    "Obrigado por perguntar. Pode me dizer qual é a sua dúvida? Respondo por aqui.",
    "Obrigado pelo retorno. Qual é a sua dúvida? Explico com calma.",
    "Boa pergunta. Me conta qual é a dúvida e eu explico.",
  ],
});

/** Responder quando o tipo de resposta não foi anotado. */
export const SALES_SAY_REPLY_OTHER = bank("vendas.resposta.outra", {
  full: ["Obrigado pelo retorno. Em que posso ajudar?", "Obrigado por responder. Como posso ajudar?", "Obrigado pelo retorno. Me diga em que posso ajudar."],
});

/** Responder a quem perguntou de onde veio o contato: dizer a verdade e oferecer parar e apagar. */
export const SALES_SAY_REPLY_ORIGIN = bank<[string, string, string]>("vendas.resposta.origem", {
  full: [
    (name, how, where) => `O contato de vocês (${name}) veio de: ${how}. Onde vi: ${where}. Se preferir que eu não escreva mais e apague o que tenho de vocês, é só dizer.`,
    (name, how, where) => `Respondendo com clareza: o contato de vocês (${name}) veio de ${how}. Onde vi: ${where}. Se quiser, eu paro de escrever e apago os dados que tenho.`,
    (name, how, where) => `Anotei o contato de vocês (${name}) a partir de ${how}. Onde vi: ${where}. Se não quiser mais mensagens, diga e eu paro e apago os dados.`,
  ],
});

/** Convidar quem já conversou para ver o Vem Comer. */
export const SALES_SAY_DEMO = bank("vendas.demonstracao", {
  full: [
    "Quer ver o Vem Comer funcionando? Mostro em uns cinco minutos. Qual horário é bom para você?",
    "Posso te mostrar o Vem Comer funcionando, em uns cinco minutos. Qual horário fica bom?",
    "Que tal ver o Vem Comer funcionando? Leva uns cinco minutos. Me diga um horário que seja bom para você.",
  ],
});

/** Perguntar a quem viu a demonstração e não se cadastrou se algo travou. */
export const SALES_SAY_STUCK = bank("vendas.travou", {
  full: [
    "Vi que você conheceu o Vem Comer. Ficou alguma dúvida ou alguma parte travou?",
    "Você já conheceu o Vem Comer. Tem alguma dúvida ou algo que ficou difícil?",
    "Passo para saber como foi ver o Vem Comer. Ficou alguma dúvida?",
  ],
});

/** Ajudar quem se cadastrou a montar o cardápio. */
export const SALES_SAY_START = bank("vendas.comecar", {
  full: [
    "Vi que você começou o cadastro. Posso ajudar a montar o cardápio, falando os pratos ou com foto.",
    "Você já começou o cadastro no Vem Comer. Posso ajudar a montar o cardápio, falando os pratos ou com foto.",
    "Seu cadastro no Vem Comer já começou. Se quiser, ajudo a montar o cardápio com você.",
  ],
});

/** O assunto do e-mail. */
export const SALES_SAY_SUBJECT = bank<[string]>("vendas.assunto", {
  full: [
    (name) => `Vem Comer: cardápio e pedidos pelo celular para ${name}`,
    (name) => `Cardápio e pedidos pelo celular: Vem Comer para ${name}`,
  ],
});

/** O assunto de um lembrete por e-mail. */
export const SALES_SAY_SUBJECT_REMIND = bank<[string]>("vendas.assunto-lembrete", {
  full: [(name) => `Sobre o Vem Comer para ${name}`, (name) => `Retomando o Vem Comer para ${name}`],
});

/** O assunto de uma resposta por e-mail. */
export const SALES_SAY_SUBJECT_REPLY = bank<[string]>("vendas.assunto-resposta", {
  full: [(name) => `Re: Vem Comer para ${name}`, (name) => `Resposta sobre o Vem Comer para ${name}`],
});

/** A linha do link, sempre sozinha. */
export const SALES_LINK_LINE = "Veja como funciona:";

/** O fecho do e-mail. */
export const SALES_SIGNATURE = "Vem Tecnologia";

/** Todas as situações com exemplos de dados, para o teste conferir a escrita de cada forma. */
export const SALES_BANKS: ReadonlyArray<{ bank: Bank<never[]>; samples: ReadonlyArray<readonly unknown[]> }> = [
  { bank: SALES_SAY_HELLO as unknown as Bank<never[]>, samples: [["Maria"], ["Seu João"]] },
  { bank: SALES_SAY_HELLO_NO_NAME as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_WHO as unknown as Bank<never[]>, samples: [["Carlos"], ["Ana Paula"]] },
  { bank: SALES_SAY_WHO_NO_NAME as unknown as Bank<never[]>, samples: [[]] },
  ...Object.values(SALES_SAY_ORIGIN).map((spec) => ({
    bank: spec as unknown as Bank<never[]>,
    samples: [["Pastelaria do Zé"], ["Casa da Maria"], ["Sorveteria Gelo Bom"]] as ReadonlyArray<readonly unknown[]>,
  })),
  { bank: SALES_SAY_WHAT as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_ASK as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_STOP as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_STOP_EMAIL as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_REMIND as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_REMIND_EASY as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_REPLY_INTERESTED as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_REPLY_DOUBT as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_REPLY_OTHER as unknown as Bank<never[]>, samples: [[]] },
  {
    bank: SALES_SAY_REPLY_ORIGIN as unknown as Bank<never[]>,
    samples: [["Pastelaria do Zé", "um anúncio público", "anúncio no Instagram em 20/10"], ["Casa da Maria", "uma indicação", "indicação do Sr. João"]],
  },
  { bank: SALES_SAY_DEMO as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_STUCK as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_START as unknown as Bank<never[]>, samples: [[]] },
  { bank: SALES_SAY_SUBJECT as unknown as Bank<never[]>, samples: [["Pastelaria do Zé"], ["Casa da Maria"]] },
  { bank: SALES_SAY_SUBJECT_REMIND as unknown as Bank<never[]>, samples: [["Pastelaria do Zé"]] },
  { bank: SALES_SAY_SUBJECT_REPLY as unknown as Bank<never[]>, samples: [["Pastelaria do Zé"]] },
];

// ---------------------------------------------------------------- os textos da tela

export const SALES_TITLE = "Vendas";
export const SALES_INTRO = "O Vem escolhe quem procurar, diz o que escrever e conta o que deu certo. Quem envia é você, uma mensagem por vez.";
export const SALES_SENDER_LABEL = "Seu nome nas mensagens";
export const SALES_SENDER_HINT = "Aparece no começo de cada rascunho. Fica só neste celular.";
export const SALES_TODAY_TITLE = "Procurar hoje";
export const SALES_TODAY_EMPTY = "Ninguém para procurar agora. Anote um negócio novo ou volte mais tarde.";
export const SALES_TODAY_MORE = (count: number): string => (count === 1 ? "Mais 1 negócio espera a vez dele." : `Mais ${count} negócios esperam a vez deles.`);
export const SALES_WAITING_TITLE = "Esperando resposta";
export const SALES_WAITING_HINT = "Quando um deles responder, toque em Respondeu e escolha o que ele disse.";
export const SALES_WAITING_EMPTY = "Ninguém esperando resposta.";
export const SALES_WAITING_MORE = (count: number): string => (count === 1 ? "Mais 1 negócio na espera." : `Mais ${count} negócios na espera.`);
export const SALES_FUNNEL_TITLE = "Como está indo";
export const SALES_FUNNEL_EMPTY = "Quando você anotar o primeiro negócio, o caminho de cada um aparece aqui.";
export const SALES_SOURCES_TITLE = "De onde vêm os que respondem";
export const SALES_ADD = "Anotar um negócio";
export const SALES_LOADING = "Abrindo as Vendas…";
export const SALES_RETRY = "Tentar de novo";
export const SALES_LOAD_ERROR = "Não consegui abrir as Vendas. Tente de novo.";

// Cartão de um negócio
export const SALES_SENT = (channel: string): string => `Já mandei no ${channel}`;
export const SALES_SENT_EMAIL = "Já mandei o e-mail";
export const SALES_SENT_CALL = "Já liguei";
export const SALES_SENT_INSTAGRAM = "Já mandei no Instagram";
export const SALES_SENT_PERSON = "Já falei pessoalmente";
export const SALES_COPY = "Copiar a mensagem";
export const SALES_COPIED = "Copiado";
export const SALES_ANOTHER = "Outra mensagem";
export const SALES_MANUAL = "O celular não deixou copiar. O texto está marcado: segure nele e escolha Copiar.";
export const SALES_OPEN_WHATSAPP = "Abrir o WhatsApp com a mensagem";
export const SALES_OPEN_EMAIL = "Abrir o e-mail com a mensagem";
export const SALES_OPEN_CALL = "Ligar";
export const SALES_OPEN_INSTAGRAM = "Abrir o Instagram";
export const SALES_OPEN_HINT = "O WhatsApp e o e-mail abrem com o texto pronto. Você confere e envia. Nada sai sozinho.";
export const SALES_CHANNEL_TITLE = "Mandar por";
export const SALES_SCRIPT_TITLE = "Roteiro da conversa";
export const SALES_NO_CHANNEL = "Falta um jeito de falar com este negócio. Veja onde ele divulga telefone, e-mail ou Instagram.";
export const SALES_REPLY_ASK = "Como foi a resposta?";
export const SALES_REPLY_LATER = "Ainda sem resposta";
export const SALES_REPLY_BUTTON = "Respondeu";
export const SALES_STAGE_TITLE = "Mudar a etapa";
export const SALES_MORE = "Mais";
export const SALES_LESS = "Fechar";
export const SALES_NO_CONFIRM = "Não quer";
export const SALES_NO_ASK = "Ele pediu para não ser procurado mais? Toque em Confirmar: o telefone e o e-mail entram na lista de quem não quer e o resto da ficha é apagado. Isso não volta atrás.";
export const SALES_NO_YES = "Confirmar: não procurar nunca mais";
export const SALES_FORGET = "Apagar os dados deste negócio";
export const SALES_FORGET_ASK = "Apagar de vez? A ficha e o histórico somem. Só fica a marca que impede de anotar o mesmo contato de novo. Isso não volta atrás.";
export const SALES_FORGET_YES = "Sim, apagar de vez";
export const SALES_BACK = "Voltar";
export const SALES_SOURCE_PREFIX = "Veio de";
export const SALES_NOTE_PREFIX = "Onde vi";
export const SALES_WAIT_LINE = (reason: string, when: string): string => `${reason} Volta a ser a vez ${when}.`;
export const SALES_CLOSE = "Encerrar este negócio";
export const SALES_NO_CHANNEL_CLOSE = "Para completar, anote o negócio de novo com o contato. Este pode ser encerrado.";

// Anotar um negócio
export const SALES_FORM_TITLE = "Anotar um negócio";
export const SALES_FORM_INTRO = "Cole ou fale o anúncio, o cartão ou a conversa. O Vem separa o telefone, o e-mail e o Instagram, e você confere.";
export const SALES_FORM_PASTE = "Texto do anúncio ou do cartão";
export const SALES_FORM_READ = "Separar os contatos";
export const SALES_FORM_READING = "Lendo…";
export const SALES_FORM_READ_NONE = "Não achei telefone, e-mail nem Instagram nesse texto. Preencha à mão.";
export const SALES_FORM_READ_OK = "Separei o que achei. Confira os campos abaixo antes de guardar.";
export const SALES_FORM_READ_MORE = (count: number): string => (count === 1 ? "Achei mais 1 telefone no texto." : `Achei mais ${count} telefones no texto.`);
export const SALES_FORM_NAME = "Nome do negócio";
export const SALES_FORM_KIND = "Tipo de negócio";
export const SALES_FORM_CITY = "Cidade";
export const SALES_FORM_NEIGHBORHOOD = "Bairro (se souber)";
export const SALES_FORM_PERSON = "Nome da pessoa (se souber)";
export const SALES_FORM_PHONE = "Telefone ou WhatsApp";
export const SALES_FORM_EMAIL = "E-mail";
export const SALES_FORM_INSTAGRAM = "Instagram (só o nome da conta)";
export const SALES_FORM_SITE = "Site";
export const SALES_FORM_SOURCE = "De onde veio este contato?";
export const SALES_FORM_SOURCE_PLACEHOLDER = "Escolha de onde veio";
export const SALES_FORM_SOURCE_HINT = "Sem a origem do contato o negócio não entra. É a regra que protege você e quem recebe a mensagem.";
export const SALES_FORM_SEEN = "Onde você viu o contato?";
export const SALES_FORM_SEEN_HINT = "Por exemplo: anúncio no Instagram em 20/10, ou site da pastelaria.";
export const SALES_FORM_NOTE = "Anotação (se quiser)";
export const SALES_FORM_SAVE = "Guardar o negócio";
export const SALES_FORM_SAVING = "Guardando…";
export const SALES_FORM_CANCEL = "Cancelar";
export const SALES_FORM_SAVED = "Negócio guardado.";
export const SALES_FORM_KNOWN = "Esse contato já estava anotado. Não criei outro.";
export const SALES_FORM_BLOCKED = "Esse contato pediu para não receber mais nada. Não foi guardado.";
export const SALES_FORM_DICTATE = "Falar o texto do anúncio";

/** O que o leitor de tela lê quando algo muda. */
/** O servidor anotou, mas a lista não veio de novo: a tela não deixa tocar duas vezes e diz o que fazer. */
export const SALES_REFRESH_LIST = "Não consegui atualizar a lista agora: saia e entre nas Vendas para ver como ficou.";
export const SALES_REFRESH_FAIL = `Anotado. ${SALES_REFRESH_LIST}`;
export const SALES_LIVE_SENT = (name: string): string => `Anotado: você falou com ${name}.`;
export const SALES_LIVE_REPLY = (name: string): string => `Anotado: ${name} respondeu.`;
export const SALES_LIVE_STAGE = (name: string, stage: string): string => `${name} agora está em: ${stage}.`;
export const SALES_LIVE_NO = (name: string): string => `${name} não será mais procurado.`;
export const SALES_LIVE_FORGOT = (name: string): string => `Os dados de ${name} foram apagados.`;
export const SALES_LIVE_COPIED = "Mensagem copiada.";
export const SALES_LIVE_OTHER = "Outra mensagem pronta.";
export const SALES_LIVE_SAVED = (name: string): string => `${name} foi guardado.`;
