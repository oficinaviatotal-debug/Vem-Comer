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

// ---------------------------------------------------------------- "acabou o pastel": marcar prato esgotado falando (sempre com confirmação)

export const SAY_DISH_WAIT = bank("prato.espera", {
  full: ["Procurando o prato…", "Olhando o cardápio…", "Um instante, procurando o prato…"],
});

/** A pergunta antes de marcar. Fala o nome do prato como está no cardápio, para a pessoa ouvir se o celular entendeu certo. */
export const SAY_DISH_ASK_SOLD = bank<[string]>("prato.pergunta-esgotou", {
  full: [
    (name) => `Marcar ${name} como esgotado? Toque em Sim, ou toque na bolinha e diga sim.`,
    (name) => `Vou marcar ${name} como esgotado. Confirma? Toque em Sim, ou diga sim na bolinha.`,
    (name) => `Esgotado: ${name}. Confirma? Toque em Sim, ou toque na bolinha e diga sim.`,
  ],
  short: [(name) => `Marcar ${name} como esgotado? Sim ou não?`, (name) => `Esgotado: ${name}. Confirma?`, (name) => `Vou marcar ${name} como esgotado. Confirma?`],
});

export const SAY_DISH_ASK_BACK = bank<[string]>("prato.pergunta-voltou", {
  full: [
    (name) => `Tirar o esgotado de ${name}? Toque em Sim, ou toque na bolinha e diga sim.`,
    (name) => `Vou deixar ${name} disponível de novo. Confirma? Toque em Sim, ou diga sim na bolinha.`,
    (name) => `Voltou: ${name}. Confirma? Toque em Sim, ou toque na bolinha e diga sim.`,
  ],
  short: [(name) => `Tirar o esgotado de ${name}? Sim ou não?`, (name) => `Voltou: ${name}. Confirma?`, (name) => `Deixar ${name} disponível de novo? Confirma?`],
});

export const SAY_DISH_DONE_SOLD = bank<[string]>("prato.feito-esgotou", {
  full: [
    (name) => `Pronto: ${name} marcado como esgotado. Para desfazer, diga: voltou ${name}.`,
    (name) => `Feito: ${name} está como esgotado. Para desfazer, diga: voltou ${name}.`,
    (name) => `Marquei ${name} como esgotado. Para desfazer, diga: voltou ${name}.`,
  ],
  short: [(name) => `Pronto: ${name} marcado como esgotado.`, (name) => `Feito: ${name} está como esgotado.`, (name) => `Marquei ${name} como esgotado.`],
});

export const SAY_DISH_DONE_BACK = bank<[string]>("prato.feito-voltou", {
  full: [(name) => `Pronto: ${name} voltou ao cardápio.`, (name) => `Feito: ${name} está disponível de novo.`, (name) => `Tirei o esgotado de ${name}.`],
});

export const SAY_DISH_ALREADY_SOLD = bank<[string]>("prato.ja-esgotado", {
  full: [(name) => `${name} já está marcado como esgotado. Não mudei nada.`, (name) => `Não mudei nada: ${name} já estava como esgotado.`, (name) => `Já estava como esgotado: ${name}. Não mudei nada.`],
});

export const SAY_DISH_ALREADY_BACK = bank<[string]>("prato.ja-disponivel", {
  full: [(name) => `${name} já está disponível. Não mudei nada.`, (name) => `Não mudei nada: ${name} já estava disponível.`, (name) => `Já estava disponível: ${name}. Não mudei nada.`],
});

/** Mais de um prato com essa palavra: não adivinha, pede o nome inteiro. */
export const SAY_DISH_MANY = bank<[string]>("prato.mais-de-um", {
  full: [
    (names) => `Achei mais de um prato: ${names}. Diga o nome inteiro.`,
    (names) => `Tem mais de um parecido: ${names}. Fale o nome inteiro.`,
    (names) => `Não sei qual deles: ${names}. Diga o nome inteiro.`,
  ],
});

export const SAY_DISH_NONE = bank("prato.nenhum", {
  full: [
    "Não achei um prato com esse nome. Abri os produtos para você procurar.",
    "Nenhum prato com esse nome. Abri os produtos para você procurar.",
    "Não encontrei esse prato. Abri os produtos para você ver a lista.",
  ],
});

export const SAY_DISH_LOAD_FAIL = bank("prato.nao-li", {
  full: [
    "Não consegui ver os pratos agora. Confira a internet e fale de novo.",
    "Os pratos não carregaram agora. Confira a internet e fale de novo.",
    "Não consegui olhar o cardápio agora. Veja a internet e fale de novo.",
  ],
});

/** Falhou ou não deu para confirmar: a voz não jura que "nada mudou" (o pedido pode ter chegado); manda conferir na tela. */
export const SAY_DISH_DO_FAIL = bank("prato.nao-marquei", {
  full: [
    "Não consegui confirmar a marcação do prato. Veja na tela de produtos como ficou.",
    "Não deu para confirmar que o prato foi marcado. Veja na tela de produtos como ficou.",
    "A marcação do prato não foi confirmada. Veja na tela de produtos como ficou.",
  ],
});

export const SAY_DISH_DOING = bank("prato.marcando", {
  full: ["Marcando o prato…", "Um instante, marcando…", "Estou marcando…"],
});

export const SAY_DISH_CANCELED = bank("prato.cancelado", {
  full: ["Certo, não mudei nada.", "Tudo bem, deixei como estava.", "Ok, não marquei nada."],
});

// ---------------------------------------------------------------- a voz do cliente: pedir falando ("quero dois pastéis")
// Nomes de botão que a voz cita ("Adicionar", "Desfazer", "Tentar de novo") são os da tela e nunca variam.

export const SAY_SHOP_LISTENING = bank("cliente.ouvindo", {
  full: ["Estou ouvindo. Diga o prato que você quer.", "Pode falar. Qual prato você quer?", "Estou aqui. Diga o nome do prato.", "Pode falar: o que você quer pedir?"],
  short: ["Estou ouvindo.", "Pode falar.", "Fale agora.", "Diga."],
});

export const SAY_SHOP_NO_VOICE = bank("cliente.sem-voz", {
  full: ["Este celular não escuta por aqui. Toque nos pratos para pedir.", "A voz não funciona neste celular. Toque nos pratos para pedir.", "Aqui o celular não deixa eu ouvir. Toque nos pratos para pedir."],
  short: ["Sem voz neste celular. Toque nos pratos.", "O celular não escuta aqui. Toque nos pratos.", "Aqui não dá para falar. Toque nos pratos."],
  after: 2,
});

/** `example` é um prato de verdade do cardápio (vazio quando não há prato que se peça agora). */
export const SAY_SHOP_BAG_EMPTY = bank<[string]>("cliente.sacola-vazia", {
  full: [
    (example) => (example ? `A sacola está vazia. Diga, por exemplo: quero ${example}.` : "A sacola está vazia. Diga o nome de um prato."),
    (example) => (example ? `Ainda não tem nada na sacola. Diga, por exemplo: quero ${example}.` : "Ainda não tem nada na sacola. Diga o nome de um prato."),
    (example) => (example ? `Sacola vazia. Diga o prato que você quer, por exemplo: ${example}.` : "Sacola vazia. Diga o prato que você quer."),
  ],
});

export const SAY_SHOP_NO_ORDERS = bank("cliente.sem-pedidos", {
  full: [
    "Você ainda não fez pedido neste celular. Quando fizer, é só dizer: acompanhar o pedido.",
    "Nenhum pedido seu por aqui ainda. Depois de pedir, diga: acompanhar o pedido.",
    "Ainda não há pedido seu neste celular. Depois de pedir, diga: acompanhar o pedido.",
  ],
});

export const SAY_SHOP_NO_TABLE = bank("cliente.sem-mesa", {
  full: [
    "Para chamar o garçom, leia o QR code da sua mesa.",
    "O garçom é chamado pela mesa: leia o QR code que está nela.",
    "Para chamar o garçom, abra este cardápio pelo QR code da mesa.",
  ],
});

export const SAY_SHOP_CLOSED = bank("cliente.fechado", {
  full: [
    "O restaurante não está recebendo pedidos agora. O aviso no alto da tela diz o motivo.",
    "Agora o restaurante não recebe pedidos. Veja o aviso no alto da tela.",
    "Sem pedidos no momento. Veja o aviso no alto da tela.",
  ],
});

export const SAY_SHOP_SOLD = bank<[string]>("cliente.esgotado", {
  full: [(name) => `${name} esgotou. Escolha outro prato.`, (name) => `${name} está esgotado agora. Escolha outro prato.`, (name) => `Esgotou: ${name}. Escolha outro prato.`],
});

export const SAY_SHOP_UNAVAILABLE = bank<[string]>("cliente.indisponivel", {
  full: [
    (name) => `${name} está indisponível agora. Escolha outro prato.`,
    (name) => `Agora ${name} não está disponível. Escolha outro prato.`,
    (name) => `${name} não dá para pedir agora. Escolha outro prato.`,
  ],
});

/** O prato tem escolhas (tamanho, extras): a voz abre a folha e a pessoa toca em Adicionar. `quantity` maior que 1 vai dita. */
export const SAY_SHOP_CHOOSE = bank<[string, number]>("cliente.escolhas", {
  full: [
    (name, quantity) => (quantity > 1 ? `Abri ${name}, para ${quantity}. Escolha o que quiser e toque em Adicionar.` : `Abri ${name}. Escolha o que quiser e toque em Adicionar.`),
    (name, quantity) => (quantity > 1 ? `Aqui está ${name}, para ${quantity}. Faça as escolhas e toque em Adicionar.` : `Aqui está ${name}. Faça as escolhas e toque em Adicionar.`),
    (name, quantity) => (quantity > 1 ? `${name}, para ${quantity}: escolha o que quiser e toque em Adicionar.` : `${name}: escolha o que quiser e toque em Adicionar.`),
  ],
  short: [
    (name, quantity) => (quantity > 1 ? `Abri ${name}, para ${quantity}. Toque em Adicionar.` : `Abri ${name}. Toque em Adicionar.`),
    (name, quantity) => (quantity > 1 ? `${name}, para ${quantity}. Toque em Adicionar.` : `${name}. Toque em Adicionar.`),
    (name, quantity) => (quantity > 1 ? `Escolha ${name}, para ${quantity}, e toque em Adicionar.` : `Escolha ${name} e toque em Adicionar.`),
  ],
});

/** O prato simples entrou na sacola. `what` diz o que entrou ("Pastel de carne" ou "2 unidades de Pastel de carne") e `bag` como a sacola ficou. */
export const SAY_SHOP_ADDED = bank<[string, string]>("cliente.coloquei", {
  full: [
    (what, bag) => `Coloquei ${what} na sacola. ${bag} Para desfazer, toque em Desfazer.`,
    (what, bag) => `Pronto: ${what} na sacola. ${bag} Para desfazer, toque em Desfazer.`,
    (what, bag) => `${what} entrou na sacola. ${bag} Para desfazer, toque em Desfazer.`,
  ],
  short: [(what, bag) => `Coloquei ${what} na sacola. ${bag}`, (what, bag) => `Pronto: ${what} na sacola. ${bag}`, (what, bag) => `${what} entrou na sacola. ${bag}`],
});

/** Quem pediu "enviar o pedido" falando: a voz abre a sacola e **diz que o envio é no botão**. Enviar nunca é por voz. */
export const SAY_SHOP_TO_SEND = bank("cliente.para-enviar", {
  full: [
    "Abrindo a sacola. Para enviar o pedido, toque em Enviar pedido.",
    "Abri a sacola. Confira e, para enviar, toque em Enviar pedido.",
    "Vamos para a sacola. Para enviar o pedido, toque em Enviar pedido.",
  ],
});

/** Quem já está na sacola e diz "enviar o pedido": a voz não abre nada, só diz onde tocar. Enviar nunca é por voz. */
export const SAY_SHOP_SEND_HERE = bank("cliente.enviar-aqui", {
  full: [
    "Você já está na sacola. Para enviar o pedido, toque em Enviar pedido.",
    "Confira os itens e, para enviar, toque em Enviar pedido.",
    "O envio é no botão: toque em Enviar pedido quando estiver tudo certo.",
  ],
});

/** Quem pediu o garçom ou a conta: a voz abre a tela da mesa, e o chamado é um toque da pessoa. */
export const SAY_SHOP_TO_TABLE = bank("cliente.para-mesa", {
  full: [
    "Abrindo a tela da mesa. Toque em Chamar garçom ou em Pedir a conta.",
    "Abri a tela da mesa. Para chamar o garçom, toque em Chamar garçom; para a conta, toque em Pedir a conta.",
    "Vamos para a tela da mesa. Toque em Chamar garçom ou em Pedir a conta.",
  ],
});

/** Quem já está na tela da mesa e pede o garçom ou a conta: não há o que abrir, a voz diz onde tocar. O chamado é um toque. */
export const SAY_SHOP_TABLE_HERE = bank("cliente.mesa-aqui", {
  full: [
    "Você está na tela da mesa. Toque em Chamar garçom ou em Pedir a conta.",
    "Já estamos na mesa. Para o garçom, toque em Chamar garçom; para a conta, toque em Pedir a conta.",
    "Aqui é a tela da mesa: toque em Chamar garçom ou em Pedir a conta.",
  ],
});

export const SAY_SHOP_MAX = bank<[string]>("cliente.maximo", {
  full: [(name) => `Já tem o máximo de ${name} na sacola.`, (name) => `${name}: a sacola já está no máximo desse prato.`, (name) => `Não dá para pôr mais ${name}: a sacola já está no máximo.`],
});

export const SAY_SHOP_REMOVED = bank<[string, string]>("cliente.tirei", {
  full: [(what, bag) => `Tirei ${what} da sacola. ${bag}`, (what, bag) => `Pronto, ${what} saiu da sacola. ${bag}`, (what, bag) => `${what} saiu da sacola. ${bag}`],
});

export const SAY_SHOP_NOT_IN_BAG = bank<[string]>("cliente.nao-esta", {
  full: [(name) => `${name} não está na sacola.`, (name) => `Não tem ${name} na sacola.`, (name) => `Na sacola não tem ${name}.`],
});

export const SAY_SHOP_MANY = bank<[string]>("cliente.mais-de-um", {
  full: [
    (names) => `Achei mais de um prato: ${names}. Diga o nome inteiro.`,
    (names) => `Tem mais de um parecido: ${names}. Fale o nome inteiro.`,
    (names) => `Não sei qual deles: ${names}. Diga o nome inteiro.`,
  ],
});

export const SAY_SHOP_NONE = bank("cliente.nenhum", {
  full: [
    "Não achei esse prato no cardápio. Diga o nome como está na tela.",
    "Esse prato não está no cardápio. Diga o nome como está na tela.",
    "Não encontrei esse prato. Diga o nome como está na tela, ou diga: buscar e uma palavra.",
  ],
});

export const SAY_SHOP_SEARCH_FOUND = bank<[string, string]>("cliente.busca", {
  full: [(text, names) => `Achei para “${text}”: ${names}.`, (text, names) => `Para “${text}” tem: ${names}.`, (text, names) => `Busquei “${text}” e achei: ${names}.`],
});

export const SAY_SHOP_SEARCH_NONE = bank<[string]>("cliente.busca-nada", {
  full: [(text) => `Não achei nada para “${text}”. Tente outra palavra.`, (text) => `Nada para “${text}”. Tente outra palavra.`, (text) => `Para “${text}” não achei nada. Tente outra palavra.`],
});

export const SAY_SHOP_LOADING = bank("cliente.abrindo", {
  full: ["O cardápio ainda está abrindo. Tente de novo em instantes.", "Um instante: o cardápio ainda está abrindo. Fale de novo daqui a pouco.", "O cardápio está abrindo. Fale de novo em instantes."],
});

export const SAY_SHOP_LOAD_FAIL = bank("cliente.nao-abriu", {
  full: ["O cardápio não abriu. Toque em Tentar de novo.", "Não consegui abrir o cardápio. Toque em Tentar de novo.", "O cardápio não carregou. Toque em Tentar de novo."],
});

export const SAY_SHOP_HELP = bank<[string]>("cliente.ajuda", {
  full: [(examples) => `Você pode dizer: ${examples}.`, (examples) => `Experimente dizer: ${examples}.`, (examples) => `Eu entendo frases como: ${examples}.`],
});

export const SAY_SHOP_UNKNOWN = bank<[string]>("cliente.nao-entendi", {
  full: [
    (examples) => `Não entendi. Diga, por exemplo: ${examples}.`,
    (examples) => `Não peguei essa. Tente dizer: ${examples}.`,
    (examples) => `Hum, não entendi. Experimente: ${examples}.`,
  ],
  short: [(examples) => `Não entendi. Tente: ${examples}.`, (examples) => `Não peguei. Diga: ${examples}.`, (examples) => `Não entendi. Por exemplo: ${examples}.`],
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
  entry(SAY_DISH_WAIT),
  entry(SAY_DISH_ASK_SOLD, ["Pastel de carne"], ["Açaí 300ml"]),
  entry(SAY_DISH_ASK_BACK, ["Pastel de carne"], ["Açaí 300ml"]),
  entry(SAY_DISH_DONE_SOLD, ["Pastel de carne"]),
  entry(SAY_DISH_DONE_BACK, ["Pastel de carne"]),
  entry(SAY_DISH_ALREADY_SOLD, ["Pastel de carne"]),
  entry(SAY_DISH_ALREADY_BACK, ["Pastel de carne"]),
  entry(SAY_DISH_MANY, ["Açaí 300ml ou Açaí 500ml"], ["Pastel de carne, Pastel de queijo ou Pastel de frango"]),
  entry(SAY_DISH_NONE),
  entry(SAY_DISH_LOAD_FAIL),
  entry(SAY_DISH_DO_FAIL),
  entry(SAY_DISH_DOING),
  entry(SAY_DISH_CANCELED),
  entry(SAY_SHOP_LISTENING),
  entry(SAY_SHOP_NO_VOICE),
  entry(SAY_SHOP_BAG_EMPTY, ["Pastel de carne"], [""]),
  entry(SAY_SHOP_NO_ORDERS),
  entry(SAY_SHOP_NO_TABLE),
  entry(SAY_SHOP_CLOSED),
  entry(SAY_SHOP_SOLD, ["Pastel de carne"]),
  entry(SAY_SHOP_UNAVAILABLE, ["Açaí 300ml"]),
  entry(SAY_SHOP_CHOOSE, ["Açaí 300ml", 1], ["Açaí 300ml", 3]),
  entry(SAY_SHOP_ADDED, ["Pastel de carne", "A sacola está com 1 item, R$ 9,00."], ["2 unidades de Pastel de carne", "A sacola está com 3 itens, R$ 27,00."]),
  entry(SAY_SHOP_TO_SEND),
  entry(SAY_SHOP_SEND_HERE),
  entry(SAY_SHOP_TABLE_HERE),
  entry(SAY_SHOP_TO_TABLE),
  entry(SAY_SHOP_MAX, ["Pastel de carne"]),
  entry(SAY_SHOP_REMOVED, ["Pastel de carne", "A sacola ficou vazia."], ["2 unidades de Pastel de carne", "A sacola está com 1 item, R$ 9,00."]),
  entry(SAY_SHOP_NOT_IN_BAG, ["Pastel de carne"]),
  entry(SAY_SHOP_MANY, ["Açaí 300ml ou Açaí 500ml"], ["Pastel de carne, Pastel de queijo e mais 2"]),
  entry(SAY_SHOP_NONE),
  entry(SAY_SHOP_SEARCH_FOUND, ["suco", "Suco de laranja ou Suco de uva"], ["pastel", "Pastel de carne, Pastel de queijo e mais 1"]),
  entry(SAY_SHOP_SEARCH_NONE, ["lasanha"]),
  entry(SAY_SHOP_LOADING),
  entry(SAY_SHOP_LOAD_FAIL),
  entry(SAY_SHOP_HELP, ["quero Pastel de carne, abrir a sacola ou acompanhar o pedido"], ["abrir a sacola"]),
  entry(SAY_SHOP_UNKNOWN, ["quero Pastel de carne, abrir a sacola ou acompanhar o pedido"], ["abrir a sacola"]),
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
