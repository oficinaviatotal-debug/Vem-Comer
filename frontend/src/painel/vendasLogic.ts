/**
 * Vendas (o painel do dono do sistema), versão nova: quem procurar hoje, quem está esperando resposta, o rascunho do que
 * escrever e o caminho de cada negócio até pagar. Só conta, sem React nem rede: tests/novo/vendasLogic.test.mjs roda isto no Node.
 *
 * **Nada aqui manda mensagem.** O rascunho aparece na tela; o WhatsApp e o e-mail abrem com o texto pronto e quem confere e
 * envia é a pessoa do Vem. Só depois ela toca em "Já mandei". As regras que protegem o negócio e a pessoa (origem do contato,
 * no máximo 3 contatos, "não quero" para sempre, apagar a pedido) moram no servidor (backend/vendas.py); a tela só mostra o
 * que ele manda e nunca contorna.
 */
import { plainPhraser, type Phraser } from "../novo/phrasing.ts";
import {
  SALES_FORM_BLOCKED,
  SALES_FORM_KNOWN,
  SALES_FORM_READ_MORE,
  SALES_FORM_READ_NONE,
  SALES_FORM_READ_OK,
  SALES_LINK_LINE,
  SALES_NOTE_PREFIX,
  SALES_OPEN_CALL,
  SALES_OPEN_EMAIL,
  SALES_OPEN_INSTAGRAM,
  SALES_OPEN_WHATSAPP,
  SALES_SAY_ASK,
  SALES_SAY_DEMO,
  SALES_SAY_HELLO,
  SALES_SAY_HELLO_NO_NAME,
  SALES_SAY_ORIGIN,
  SALES_SAY_REMIND,
  SALES_SAY_REMIND_EASY,
  SALES_SAY_REPLY_DOUBT,
  SALES_SAY_REPLY_INTERESTED,
  SALES_SAY_REPLY_ORIGIN,
  SALES_SAY_REPLY_OTHER,
  SALES_SAY_START,
  SALES_SAY_STOP,
  SALES_SAY_STOP_EMAIL,
  SALES_SAY_STUCK,
  SALES_SAY_SUBJECT,
  SALES_SAY_SUBJECT_REMIND,
  SALES_SAY_SUBJECT_REPLY,
  SALES_SAY_WHAT,
  SALES_SAY_WHO,
  SALES_SAY_WHO_NO_NAME,
  SALES_SENT,
  SALES_SENT_CALL,
  SALES_SENT_EMAIL,
  SALES_SENT_INSTAGRAM,
  SALES_SENT_PERSON,
  SALES_SIGNATURE,
  SALES_SOURCE_PREFIX,
  SALES_TODAY_MORE,
  SALES_WAIT_LINE,
  SALES_WAITING_MORE,
} from "../novo/vendasCopy.ts";
import type {
  SalesCardView,
  SalesChannelId,
  SalesChoice,
  SalesDraftView,
  SalesFormValues,
  SalesFormView,
  SalesFunnelView,
  SalesView,
} from "../novo/types.ts";
import type { ContactRead, NewProspect, ReplyResult, SalesOverview, SalesProspect } from "../service/salesApi.ts";

/** Os formatos que o servidor manda, para a página de conferência (`novo/demo.ts`) não precisar importar o serviço. */
export type { SalesMove, SalesOverview, SalesProspect } from "../service/salesApi.ts";

export type { SalesView };

// ---------------------------------------------------------------- vocabulário

export const CHANNEL_LABELS: Record<SalesChannelId, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  ligacao: "Ligação",
  instagram: "Instagram",
  presencial: "Pessoalmente",
};

const CHANNEL_IDS: readonly SalesChannelId[] = ["whatsapp", "email", "ligacao", "instagram", "presencial"];

const isChannel = (value: unknown): value is SalesChannelId => CHANNEL_IDS.includes(value as SalesChannelId);

/** As origens que a pessoa escolhe. "Formulário do site" não está: só o próprio formulário cria essa. */
export const SOURCE_CHOICES: readonly SalesChoice[] = [
  { id: "anuncio_publico", label: "Anúncio público (o próprio negócio divulgou)" },
  { id: "site_da_empresa", label: "Site do negócio" },
  { id: "indicacao", label: "Indicação de alguém" },
  { id: "parceiro", label: "Parceiro" },
  { id: "pedido_do_contato", label: "O negócio pediu contato" },
  { id: "visita", label: "Visita" },
];

export const KIND_CHOICES: readonly SalesChoice[] = [
  { id: "restaurante", label: "Restaurante" },
  { id: "lanchonete", label: "Lanchonete" },
  { id: "pizzaria", label: "Pizzaria" },
  { id: "pastelaria", label: "Pastelaria" },
  { id: "sorveteria", label: "Sorveteria" },
  { id: "acai", label: "Açaí" },
  { id: "padaria", label: "Padaria" },
  { id: "bar", label: "Bar" },
  { id: "hamburgueria", label: "Hamburgueria" },
  { id: "marmitaria", label: "Marmitaria" },
  { id: "confeitaria", label: "Confeitaria" },
  { id: "outro", label: "Outro negócio de comida" },
];

/** Como o negócio respondeu. "Não quer" fica de fora: tem confirmação própria, porque não volta atrás. */
export const REPLY_CHOICES: readonly SalesChoice[] = [
  { id: "interessado", label: "Quer ver" },
  { id: "duvida", label: "Tem uma dúvida" },
  { id: "quer_saber_origem", label: "Perguntou de onde veio o contato" },
  { id: "adiar", label: "Pediu para falar depois" },
];

export const REPLY_IDS: readonly ReplyResult[] = ["interessado", "duvida", "quer_saber_origem", "adiar", "nao_quer"];

/** A origem dita em uma frase, para responder a quem perguntou "de onde veio o contato?". */
const SOURCE_HOW: Record<string, string> = {
  anuncio_publico: "um anúncio público",
  site_da_empresa: "o site de vocês",
  indicacao: "uma indicação",
  parceiro: "um parceiro",
  pedido_do_contato: "um pedido de contato de vocês",
  visita: "uma visita",
  formulario_do_site: "o formulário do nosso site",
};

// ---------------------------------------------------------------- as etapas (o mesmo caminho do servidor)

const RANK: Record<string, number> = { achado: 0, chamado: 1, respondeu: 2, demonstracao: 3, cadastrou: 4, pagando: 5 };
const STAGE_TEXT: Record<string, string> = {
  demonstracao: "Viu a demonstração",
  cadastrou: "Cadastrou",
  pagando: "Está pagando",
  sem_resposta: "Encerrar: sem resposta",
  perdido: "Perdi o negócio",
};

/** O nome da etapa para dizer em voz alta ("Pizzaria agora está em: Sem resposta"), diferente do texto do botão. */
const STAGE_SAID: Record<string, string> = {
  demonstracao: "Viu a demonstração",
  cadastrou: "Cadastrou",
  pagando: "Está pagando",
  sem_resposta: "Sem resposta",
  perdido: "Perdido",
};

export function stageSaid(stage: string): string {
  return STAGE_SAID[stage] ?? "outra etapa";
}

/** Pode mudar de `from` para `to`? É a regra de backend/vendas.py::can_move: só para a frente; quem disse não, não muda. */
export function canMove(from: string, to: string): boolean {
  const known = [...Object.keys(RANK), "nao_quer", "sem_resposta", "perdido"];
  if (!known.includes(from) || !known.includes(to)) return false;
  if (from === to) return true;
  if (from === "nao_quer") return false;
  if (to === "nao_quer") return true;
  if (from === "sem_resposta" || from === "perdido") return to in RANK && RANK[to] >= RANK.respondeu;
  if (to === "sem_resposta" || to === "perdido") return true;
  return RANK[to] > RANK[from];
}

/** Para onde este negócio pode andar com um toque (sem "respondeu", que tem o painel próprio, e sem "não quer"). */
export function stageChoices(stage: string): SalesChoice[] {
  return Object.keys(STAGE_TEXT)
    // "Sem resposta" só faz sentido para quem ainda não respondeu nem viu a demonstração
    .filter((id) => id !== "sem_resposta" || (stage in RANK && RANK[stage] <= RANK.respondeu))
    .filter((id) => id !== stage && canMove(stage, id))
    .map((id) => ({ id, label: STAGE_TEXT[id] }));
}

// ---------------------------------------------------------------- quem assina

const HONORIFICS = new Set(["dona", "seu", "sr", "sr.", "sra", "sra.", "senhor", "senhora", "dr", "dr.", "dra", "dra."]);

/** "Maria, dono" e "João Silva" viram "Maria" e "João"; "Dona Maria Souza" e "Seu João" ficam "Dona Maria" e "Seu João". */
export function firstName(person: string | null | undefined): string {
  const head = String(person ?? "").split(",")[0] ?? "";
  const words = cleanSender(head).split(" ").filter(Boolean);
  if (words.length > 1 && HONORIFICS.has(words[0].toLowerCase())) return `${words[0]} ${words[1]}`;
  return words[0] ?? "";
}

/** O nome que assina os rascunhos: só letras, espaço, apóstrofo, hífen e ponto; no máximo 30. */
export function cleanSender(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/[^\p{L}\s'.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .trim();
}

const cleanName = (name: string | null | undefined): string => String(name ?? "").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- os canais e os botões que abrem o aplicativo

/** Os jeitos de falar com o negócio: os que a ficha tem, do melhor para o pior, e "pessoalmente" sempre. */
export function channelOptions(prospect: SalesProspect): SalesChannelId[] {
  const own = (prospect.channels ?? []).filter(isChannel).filter((channel) => channel !== "presencial");
  return [...own, "presencial"];
}

/** O canal da vez: o que a pessoa escolheu, senão o que o Vem sugere, senão o primeiro que a ficha tem. */
export function channelOf(prospect: SalesProspect, chosen?: string | null): SalesChannelId {
  const options = channelOptions(prospect);
  if (chosen && isChannel(chosen) && options.includes(chosen)) return chosen;
  const suggested = prospect.move?.channel;
  if (suggested && isChannel(suggested) && options.includes(suggested)) return suggested;
  return options[0];
}

export function sendLabel(channel: SalesChannelId): string {
  switch (channel) {
    case "whatsapp":
      return SALES_SENT(CHANNEL_LABELS.whatsapp);
    case "email":
      return SALES_SENT_EMAIL;
    case "ligacao":
      return SALES_SENT_CALL;
    case "instagram":
      return SALES_SENT_INSTAGRAM;
    default:
      return SALES_SENT_PERSON;
  }
}

const SAFE_PHONE = /^\d{12,13}$/;
const SAFE_EMAIL = /^[^\s@?&#<>"'%]+@[^\s@?&#<>"'%]+\.[^\s@?&#<>"'%]+$/;
const SAFE_HANDLE = /^[a-z0-9._]{1,30}$/;

/** O endereço que abre o aplicativo com o texto pronto. `null` quando a ficha não tem o canal ou o dado parece estranho. */
export function openHref(prospect: SalesProspect, channel: SalesChannelId, text: string, subject: string | null): string | null {
  if (channel === "whatsapp") {
    const number = String(prospect.whatsapp ?? "");
    return SAFE_PHONE.test(number) ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
  }
  if (channel === "email") {
    const email = String(prospect.email ?? "").trim();
    if (!SAFE_EMAIL.test(email)) return null;
    return `mailto:${email}?subject=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(text)}`;
  }
  if (channel === "ligacao") {
    const digits = String(prospect.phone ?? "").replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) return null;
    return `tel:+55${digits}`;
  }
  if (channel === "instagram") {
    const handle = String(prospect.instagram ?? "").trim().toLowerCase();
    return SAFE_HANDLE.test(handle) ? `https://www.instagram.com/${handle}/` : null;
  }
  return null;
}

function openLabel(channel: SalesChannelId): string {
  switch (channel) {
    case "whatsapp":
      return SALES_OPEN_WHATSAPP;
    case "email":
      return SALES_OPEN_EMAIL;
    case "ligacao":
      return SALES_OPEN_CALL;
    case "instagram":
      return SALES_OPEN_INSTAGRAM;
    default:
      return "";
  }
}

// ---------------------------------------------------------------- os rascunhos

export type Draft = {
  channel: SalesChannelId;
  /** O assunto, só no e-mail. */
  subject: string | null;
  /** O texto para mandar. Vazio na ligação e na visita. */
  text: string;
  /** O roteiro, só na ligação e na visita. */
  script: string[];
};

export type DraftInput = {
  prospect: SalesProspect;
  /** Quem assina (pode vir vazio). */
  sender: string;
  /** O link da página de vendas do Vem (sem preço). */
  salesLink: string;
  channel: SalesChannelId;
  phraser?: Phraser;
};

/** As jogadas que têm texto para escrever. As outras ("esperar", "encerrar", "achar_contato") não têm rascunho. */
const DRAFT_ACTIONS = [
  "primeiro_contato",
  "lembrete",
  "responder",
  "responder_origem",
  "convidar_para_demonstracao",
  "perguntar_se_travou",
  "ajudar_a_comecar",
] as const;

export function hasDraft(prospect: SalesProspect): boolean {
  return (DRAFT_ACTIONS as readonly string[]).includes(prospect.move?.action);
}

/** O rascunho muda quando muda qualquer coisa que o torna outro texto: a jogada, a resposta, o canal, quem assina, o link. */
export function draftKey(prospect: SalesProspect, channel: SalesChannelId, sender: string, salesLink: string): string {
  return [prospect.id, prospect.move?.action, prospect.reply_kind ?? "", channel, sender, salesLink].join("|");
}

/**
 * O rascunho de um negócio. Todo primeiro contato e todo lembrete dizem quem fala (Vem Tecnologia), de onde veio o contato
 * (o lembrete, quando muda de canal) e como parar ("responda NÃO"). Nada de preço, desconto nem promessa.
 */
export function draftOf(input: DraftInput): Draft {
  const { prospect, channel, salesLink } = input;
  const phraser = input.phraser ?? plainPhraser;
  const sender = cleanSender(input.sender);
  const business = cleanName(prospect.business_name);
  const action = prospect.move?.action;
  const empty: Draft = { channel, subject: null, text: "", script: [] };
  if (!hasDraft(prospect)) return empty;

  const who = sender ? phraser.say(SALES_SAY_WHO, sender) : phraser.say(SALES_SAY_WHO_NO_NAME);
  const person = firstName(prospect.contact_person);
  const hello = person ? phraser.say(SALES_SAY_HELLO, person) : phraser.say(SALES_SAY_HELLO_NO_NAME);
  const originBank = SALES_SAY_ORIGIN[prospect.source];
  const origin = originBank ? phraser.say(originBank, business) : "";
  const stop = phraser.say(channel === "email" ? SALES_SAY_STOP_EMAIL : SALES_SAY_STOP);
  const link = `${SALES_LINK_LINE}\n${salesLink}`;
  const joined = (parts: string[]): string => parts.filter(Boolean).join(" ");

  let paragraphs: string[] = [];
  let subjectFrom: "first" | "remind" | "reply" = "reply";
  let callOrigin = true;

  switch (action) {
    case "primeiro_contato":
      subjectFrom = "first";
      paragraphs = [joined([hello, who, origin]), joined([phraser.say(SALES_SAY_WHAT), phraser.say(SALES_SAY_ASK)]), link, stop];
      break;
    case "lembrete": {
      subjectFrom = "remind";
      const changed = Boolean(prospect.last_channel) && prospect.last_channel !== channel;
      paragraphs = [joined([hello, who, changed ? origin : ""]), joined([phraser.say(SALES_SAY_REMIND), phraser.say(SALES_SAY_REMIND_EASY)]), link, stop];
      break;
    }
    case "responder": {
      callOrigin = false;
      if (prospect.reply_kind === "interessado") paragraphs = [phraser.say(SALES_SAY_REPLY_INTERESTED), link];
      else if (prospect.reply_kind === "duvida") paragraphs = [phraser.say(SALES_SAY_REPLY_DOUBT)];
      else paragraphs = [phraser.say(SALES_SAY_REPLY_OTHER)];
      break;
    }
    case "responder_origem": {
      callOrigin = false;
      const how = SOURCE_HOW[prospect.source] ?? "um contato público";
      const where = cleanName(prospect.source_note) || "não anotei";
      paragraphs = [phraser.say(SALES_SAY_REPLY_ORIGIN, business, how, where)];
      break;
    }
    case "convidar_para_demonstracao":
      callOrigin = false;
      paragraphs = [phraser.say(SALES_SAY_DEMO), link];
      break;
    case "perguntar_se_travou":
      callOrigin = false;
      paragraphs = [phraser.say(SALES_SAY_STUCK)];
      break;
    case "ajudar_a_comecar":
      callOrigin = false;
      paragraphs = [phraser.say(SALES_SAY_START)];
      break;
    default:
      return empty;
  }

  if (channel === "ligacao" || channel === "presencial") {
    const script =
      action === "primeiro_contato" || action === "lembrete"
        ? [
            `Diga quem é: ${who}`,
            callOrigin && origin ? `Diga de onde veio o contato: ${origin}` : "",
            `Explique em uma frase: ${phraser.say(SALES_SAY_WHAT)}`,
            "Pergunte se pode falar um minuto. Se estiver ocupado, combine outro horário.",
            "Se ele pedir para parar, agradeça, encerre a conversa e toque em Não quer.",
          ]
        : [`Diga quem é: ${who}`, `Assunto: ${paragraphs[0]}`, "Se ele pedir para parar, agradeça, encerre a conversa e toque em Não quer."];
    return { channel, subject: null, text: "", script: script.filter(Boolean) };
  }

  if (channel === "email") {
    const subjectBank = subjectFrom === "first" ? SALES_SAY_SUBJECT : subjectFrom === "remind" ? SALES_SAY_SUBJECT_REMIND : SALES_SAY_SUBJECT_REPLY;
    const sign = ["Atenciosamente,", sender, SALES_SIGNATURE].filter(Boolean).join("\n");
    return { channel, subject: phraser.say(subjectBank, business), text: `${paragraphs.join("\n\n")}\n\n${sign}`, script: [] };
  }

  return { channel, subject: null, text: paragraphs.join("\n"), script: [] };
}

/** "Outra mensagem": um texto diferente do que está na tela (o sorteio não repete, mas a sacola pode recomeçar). */
export function anotherDraft(input: DraftInput, current: Draft): Draft {
  let next = draftOf(input);
  for (let tries = 0; tries < 6 && sameDraft(next, current); tries += 1) next = draftOf(input);
  return next;
}

function sameDraft(a: Draft, b: Draft): boolean {
  return a.text === b.text && a.subject === b.subject && a.script.join("\n") === b.script.join("\n");
}

/** O que vai para a área de transferência quando a pessoa toca em copiar. */
export function copyTextOf(draft: Draft): string {
  if (draft.script.length > 0) return draft.script.join("\n");
  return draft.subject ? `${draft.subject}\n\n${draft.text}` : draft.text;
}

// ---------------------------------------------------------------- a espera e o horário

const DAY_MS = 86400000;
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** Brasília não tem horário de verão desde 2019: menos 3 horas, sem tabela de fusos. */
function brasilia(date: Date): { day: number; weekday: number; text: string } {
  const shifted = new Date(date.getTime() - 3 * 3600 * 1000);
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return { day: Math.floor(shifted.getTime() / DAY_MS), weekday: shifted.getUTCDay(), text: `${dd}/${mm}` };
}

/** "hoje", "amanhã", "na quinta-feira, 22/10" ou "no domingo, 25/10". */
export function whenText(due: string | null | undefined, now: Date): string {
  const when = due ? new Date(due) : null;
  if (!when || Number.isNaN(when.getTime())) return "em breve";
  const target = brasilia(when);
  const today = brasilia(now);
  const diff = target.day - today.day;
  if (diff <= 0) return "hoje";
  if (diff === 1) return "amanhã";
  const article = target.weekday === 0 || target.weekday === 6 ? "no" : "na";
  return `${article} ${WEEKDAYS[target.weekday]}, ${target.text}`;
}

// ---------------------------------------------------------------- o cartão de um negócio

export type CardUi = {
  channel?: string | null;
  replyOpen?: boolean;
  moreOpen?: boolean;
  confirm?: "nao_quer" | "apagar" | null;
  busy?: boolean;
  error?: string;
  copied?: boolean;
  manual?: string | null;
};

export type CardInput = {
  prospect: SalesProspect;
  kind: "today" | "waiting";
  ui?: CardUi;
  /** O rascunho já feito para o canal da vez (a tela guarda, para o texto não mudar a cada desenho). */
  draft?: Draft | null;
  now: Date;
};

/** As jogadas em que a pessoa fala com o negócio e depois toca em "Já mandei". */
const CONTACT_ACTIONS = new Set<string>(DRAFT_ACTIONS);

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.map((part) => cleanName(part)).filter(Boolean).join(" · ");
}

export function contactLine(prospect: SalesProspect): string {
  const insta = prospect.instagram ? `@${prospect.instagram}` : "";
  const site = prospect.site ? prospect.site.replace(/^https?:\/\//i, "").replace(/\/$/, "") : "";
  return joinParts([prospect.phone, prospect.email, insta, site]) || "Sem contato anotado";
}

export function originLine(prospect: SalesProspect): string {
  const note = cleanName(prospect.source_note);
  const base = `${SALES_SOURCE_PREFIX}: ${cleanName(prospect.source_label) || cleanName(prospect.source)}.`;
  return note ? `${base} ${SALES_NOTE_PREFIX}: ${note}.` : base;
}

function timingLine(prospect: SalesProspect): string {
  const window = cleanName(prospect.window);
  if (!window) return "";
  return prospect.good_time ? `Boa hora para procurar (${window})` : `Melhor hora: ${window}`;
}

export function cardOf(input: CardInput): SalesCardView {
  const { prospect, kind, now } = input;
  const ui = input.ui ?? {};
  const action = prospect.move?.action ?? "";
  const channel = channelOf(prospect, ui.channel);
  const waiting = kind === "waiting";
  const contactable = !waiting && CONTACT_ACTIONS.has(action);
  const draft = contactable ? input.draft ?? null : null;

  let draftView: SalesDraftView | null = null;
  if (contactable && draft) {
    const options = channelOptions(prospect);
    const href = openHref(prospect, channel, draft.text, draft.subject);
    draftView = {
      channels: options.length > 1 ? options.map((id) => ({ id, label: CHANNEL_LABELS[id], selected: id === channel })) : [],
      channel,
      channelLabel: CHANNEL_LABELS[channel],
      subject: draft.subject,
      text: draft.text,
      script: draft.script,
      openHref: href,
      openLabel: href ? openLabel(channel) : "",
      copied: Boolean(ui.copied),
      manual: ui.manual ?? null,
    };
  }

  const line = waiting
    ? SALES_WAIT_LINE(cleanName(prospect.move?.reason) || "Já foi chamado.", whenText(prospect.move?.due, now))
    : cleanName(prospect.move?.reason);

  return {
    id: prospect.id,
    name: cleanName(prospect.business_name),
    meta: joinParts([prospect.kind_label, prospect.city, prospect.neighborhood]),
    contact: contactLine(prospect),
    origin: originLine(prospect),
    stage: cleanName(prospect.stage_label),
    line,
    timing: waiting ? "" : timingLine(prospect),
    goodTime: !waiting && Boolean(prospect.good_time),
    draft: draftView,
    noChannel: !waiting && action === "achar_contato",
    canMarkSent: contactable && Boolean(draft),
    sendLabel: sendLabel(channel),
    canClose: !waiting && (action === "encerrar" || action === "achar_contato"),
    replyOpen: Boolean(ui.replyOpen),
    replies: REPLY_CHOICES.map((choice) => ({ ...choice })),
    stages: stageChoices(prospect.stage),
    moreOpen: Boolean(ui.moreOpen),
    confirm: ui.confirm ?? null,
    busy: Boolean(ui.busy),
    error: ui.error ?? "",
  };
}

// ---------------------------------------------------------------- o funil

export function funnelOf(overview: SalesOverview["funnel"]): SalesFunnelView {
  const main = ["achado", "chamado", "respondeu", "demonstracao", "cadastrou", "pagando"];
  const closed = ["nao_quer", "sem_resposta", "perdido"];
  const counts = new Map(overview.by_stage.map((row) => [row.stage, row]));
  const rows = [...main, ...closed.filter((id) => (counts.get(id)?.count ?? 0) > 0)]
    .map((id) => counts.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const top = Math.max(1, ...rows.map((row) => row.count));
  const percent = (value: number): string => `${Math.round(value * 100)}%`;
  return {
    total: overview.total,
    paying: overview.paying,
    stages: rows.map((row) => ({ id: row.stage, label: row.label, count: row.count, share: row.count > 0 ? Math.max(4, Math.round((row.count / top) * 100)) : 0 })),
    sources: overview.by_source.map((row) => ({
      id: row.source,
      label: row.label,
      line:
        row.chamados > 0
          ? `${row.total} anotados, ${row.chamados} chamados, ${row.responderam} responderam (${percent(row.taxa_resposta)}), ${row.cadastraram} cadastraram, ${row.pagando} pagando.`
          : `${row.total} anotados, nenhum chamado ainda.`,
    })),
  };
}

// ---------------------------------------------------------------- a tela inteira

export type ViewInput = {
  load: "loading" | "ready" | "error";
  error?: string;
  overview: SalesOverview | null;
  sender: string;
  ui?: Record<string, CardUi>;
  /** O rascunho do canal da vez, por negócio. */
  drafts?: Record<string, Draft | null | undefined>;
  form?: SalesFormView | null;
  saved?: string;
  live?: string;
  now: Date;
};

const EMPTY_FUNNEL: SalesFunnelView = { total: 0, paying: 0, stages: [], sources: [] };

/** A frase debaixo do título: quantos para procurar, quantos esperando, quantos pagando. */
export function subOf(overview: SalesOverview | null): string {
  if (!overview) return "";
  const today = overview.today.items.length + overview.today.more;
  const waiting = overview.waiting.items.length + overview.waiting.more;
  const parts = [today > 0 ? `${today} para procurar hoje` : "Nada para procurar agora"];
  if (waiting > 0) parts.push(`${waiting} esperando resposta`);
  if (overview.funnel.paying > 0) parts.push(`${overview.funnel.paying} pagando`);
  return parts.join(" · ");
}

export function salesViewOf(input: ViewInput): SalesView {
  const { overview, now } = input;
  const ui = input.ui ?? {};
  const drafts = input.drafts ?? {};
  const ready = input.load === "ready" && overview;
  const today = ready ? overview.today : { items: [], more: 0, touches_today: 0, notes: [] as string[] };
  const waiting = ready ? overview.waiting : { items: [], more: 0 };
  return {
    sub: ready ? subOf(overview) : "",
    load: input.load,
    error: input.error ?? "",
    sender: input.sender,
    notes: today.notes,
    today: today.items.map((prospect) => cardOf({ prospect, kind: "today", ui: ui[prospect.id], draft: drafts[prospect.id] ?? null, now })),
    todayMore: today.more > 0 ? SALES_TODAY_MORE(today.more) : "",
    waiting: waiting.items.map((prospect) => cardOf({ prospect, kind: "waiting", ui: ui[prospect.id], now })),
    waitingMore: waiting.more > 0 ? SALES_WAITING_MORE(waiting.more) : "",
    funnel: ready ? funnelOf(overview.funnel) : EMPTY_FUNNEL,
    form: input.form ?? null,
    saved: input.saved ?? "",
    live: input.live ?? "",
  };
}

// ---------------------------------------------------------------- anotar um negócio

export function emptyForm(): SalesFormValues {
  return { paste: "", name: "", kind: "restaurante", city: "", neighborhood: "", person: "", phone: "", email: "", instagram: "", site: "", source: "", seen: "", note: "" };
}

/** O que a leitura do texto achou entra nos campos vazios (nunca apaga o que a pessoa já escreveu). */
export function applyRead(values: SalesFormValues, read: ContactRead): { values: SalesFormValues; note: string } {
  const next: SalesFormValues = { ...values };
  const fill = (key: "name" | "phone" | "email" | "instagram" | "site", value: string | null) => {
    if (value && !cleanName(next[key])) next[key] = value;
  };
  fill("name", read.name);
  fill("phone", read.phone ? readablePhone(read.phone) : null);
  fill("email", read.email);
  fill("instagram", read.instagram);
  fill("site", read.site);
  const contacts = [read.phone, read.email, read.instagram, read.site].filter(Boolean).length;
  if (contacts === 0) return { values: next, note: SALES_FORM_READ_NONE };
  const extra = read.other_phones.length > 0 ? ` ${SALES_FORM_READ_MORE(read.other_phones.length)}` : "";
  return { values: next, note: `${SALES_FORM_READ_OK}${extra}` };
}

/** 5584999998888 vira (84) 99999-8888, para a pessoa conferir. */
function readablePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

const squeeze = (text: string): string => text.replace(/\s+/g, " ").trim();

/** O primeiro problema que a pessoa precisa resolver antes de guardar, em frase inteira. O servidor confere de novo. */
export function formProblem(values: SalesFormValues): string {
  const name = squeeze(values.name);
  if (name.length < 2 || name.length > 80) return "Escreva o nome do negócio (de 2 a 80 letras).";
  const city = squeeze(values.city);
  if (city.length < 2 || city.length > 60) return "Escreva a cidade.";
  if (!SOURCE_CHOICES.some((choice) => choice.id === values.source)) return "Diga de onde veio o contato. Sem isso o negócio não entra.";
  const seen = squeeze(values.seen);
  if (seen.length < 3) return "Diga onde você viu o contato (por exemplo: anúncio no Instagram em 20/10).";
  if (seen.length > 300) return "Onde você viu o contato: escreva menos (até 300 letras).";
  if (squeeze(values.note).length > 300) return "A anotação ficou grande. Deixe até 300 letras.";
  const reachable = [values.phone, values.email, values.instagram, values.site].some((value) => squeeze(value));
  if (!reachable && values.source !== "visita") return "Falta um jeito de falar com o negócio: telefone, e-mail, Instagram ou site.";
  return "";
}

/** Só os campos preenchidos viajam. */
export function toNewProspect(values: SalesFormValues): NewProspect {
  const out: NewProspect = {
    business_name: squeeze(values.name),
    business_kind: values.kind || "outro",
    city: squeeze(values.city),
    source: values.source,
    source_note: squeeze(values.seen),
  };
  const optional: Array<[keyof NewProspect, string]> = [
    ["neighborhood", values.neighborhood],
    ["contact_person", values.person],
    ["phone", values.phone],
    ["email", values.email],
    ["instagram", values.instagram],
    ["site", values.site],
    ["note", values.note],
  ];
  for (const [key, value] of optional) {
    const clean = squeeze(value);
    if (clean) (out as Record<string, string>)[key] = clean;
  }
  return out;
}

export function formViewOf(values: SalesFormValues, state: { reading?: boolean; readNote?: string; saving?: boolean; error?: string }): SalesFormView {
  return {
    values,
    kinds: KIND_CHOICES.map((choice) => ({ ...choice })),
    sources: SOURCE_CHOICES.map((choice) => ({ ...choice })),
    reading: Boolean(state.reading),
    readNote: state.readNote ?? "",
    saving: Boolean(state.saving),
    error: state.error ?? "",
    canSave: formProblem(values) === "",
  };
}

/** O que dizer depois de guardar, conforme o servidor respondeu. */
export function savedText(answer: { created: boolean; reason: string | null }, name: string): string {
  if (answer.reason === "na_lista_de_bloqueio") return SALES_FORM_BLOCKED;
  if (!answer.created) return SALES_FORM_KNOWN;
  return `${cleanName(name)} foi guardado.`;
}

