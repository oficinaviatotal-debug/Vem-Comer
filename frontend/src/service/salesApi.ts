import { API_URL, HttpError, expireSession, getToken } from "./api";

/**
 * A máquina de vendas do Vem (servidor: backend/vendas_api.py). Só o dono do sistema (administrador da plataforma) abre.
 * Nada aqui manda mensagem a ninguém: as rotas só anotam o que uma pessoa do Vem fez e dizem o que fazer em seguida.
 */

export type SalesMove = {
  /** primeiro_contato, lembrete, responder, responder_origem, convidar_para_demonstracao, perguntar_se_travou, ajudar_a_comecar, achar_contato, esperar, encerrar… */
  action: string;
  reason: string;
  channel: string | null;
  due: string | null;
  tags: string[];
};

export type SalesProspect = {
  id: string;
  business_name: string;
  kind: string;
  kind_label: string;
  city: string | null;
  neighborhood: string | null;
  contact_person: string | null;
  /** O telefone como se lê: (84) 99999-8888. */
  phone: string;
  /** O celular com 55 na frente, só quando serve para WhatsApp. */
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  site: string | null;
  source: string;
  source_label: string;
  source_note: string | null;
  note: string | null;
  stage: string;
  stage_label: string;
  days_in_stage: number;
  touches: number;
  channels: string[];
  last_channel: string | null;
  reply_kind: string | null;
  move: SalesMove;
  window: string;
  good_time: boolean;
};

export type SalesFunnel = {
  total: number;
  paying: number;
  by_stage: { stage: string; label: string; count: number }[];
  by_source: {
    source: string;
    label: string;
    total: number;
    chamados: number;
    responderam: number;
    cadastraram: number;
    pagando: number;
    taxa_resposta: number;
    taxa_cadastro: number;
    taxa_pagamento: number;
  }[];
};

export type SalesOverview = {
  today: { items: SalesProspect[]; more: number; touches_today: number; notes: string[] };
  waiting: { items: SalesProspect[]; more: number };
  funnel: SalesFunnel;
};

export type ContactRead = {
  name: string | null;
  phone: string | null;
  other_phones: string[];
  email: string | null;
  instagram: string | null;
  site: string | null;
};

/** O que a pessoa conferiu e quer guardar. Só estes campos viajam. */
export type NewProspect = {
  business_name: string;
  business_kind: string;
  city: string;
  neighborhood?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  site?: string;
  source: string;
  source_note: string;
  note?: string;
};

export type ReplyResult = "interessado" | "duvida" | "quer_saber_origem" | "adiar" | "nao_quer";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(response: Response, fallback: string): Promise<HttpError> {
  if (response.status === 401) expireSession();
  const err = await response.json().catch(() => ({}));
  return new HttpError(typeof err?.error === "string" && err.error ? err.error : fallback, response.status);
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

async function post(path: string, body: unknown, fallback: string): Promise<any> {
  const response = await fetch(`${API_URL}/platform/sales${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw await readError(response, fallback);
  return response.json().catch(() => ({}));
}

/** Quem procurar hoje, quem está esperando resposta e o funil. 403 para quem não é o dono do sistema. */
export async function fetchSales(): Promise<SalesOverview> {
  const response = await fetch(`${API_URL}/platform/sales`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir as Vendas. Tente de novo.");
  const body = await response.json();
  const today = body?.today ?? {};
  const waiting = body?.waiting ?? {};
  const funnel = body?.funnel ?? {};
  return {
    today: {
      items: list<SalesProspect>(today.items),
      more: count(today.more),
      touches_today: count(today.touches_today),
      notes: list<string>(today.notes).filter((note) => typeof note === "string"),
    },
    waiting: { items: list<SalesProspect>(waiting.items), more: count(waiting.more) },
    funnel: {
      total: count(funnel.total),
      paying: count(funnel.paying),
      by_stage: list(funnel.by_stage),
      by_source: list(funnel.by_source),
    },
  };
}

/** Separa telefone, e-mail, Instagram e site de um texto colado ou falado. Não grava nada. */
export async function readContact(text: string): Promise<ContactRead> {
  const found = await post("/read-contact", { text }, "Não consegui ler esse texto.");
  return {
    name: typeof found?.name === "string" ? found.name : null,
    phone: typeof found?.phone === "string" ? found.phone : null,
    other_phones: list<string>(found?.other_phones),
    email: typeof found?.email === "string" ? found.email : null,
    instagram: typeof found?.instagram === "string" ? found.instagram : null,
    site: typeof found?.site === "string" ? found.site : null,
  };
}

/** Guarda um negócio. O servidor recusa sem a origem do contato e diz, em frase inteira, o que falta. */
export async function addProspect(data: NewProspect): Promise<{ created: boolean; reason: string | null }> {
  const answer = await post("/prospects", data, "Não consegui guardar o negócio.");
  return { created: answer?.created === true, reason: typeof answer?.reason === "string" ? answer.reason : null };
}

/** "Já mandei": uma pessoa do Vem falou com o negócio por este canal. */
export async function markSent(id: string, channel: string): Promise<void> {
  await post(`/prospects/${encodeURIComponent(id)}/touch`, { channel }, "Não consegui anotar o contato.");
}

/** O que o negócio respondeu, escolhido pela pessoa. O texto da conversa nunca vai para o servidor. */
export async function markReply(id: string, result: ReplyResult): Promise<{ stage: string }> {
  const answer = await post(`/prospects/${encodeURIComponent(id)}/reply`, { result }, "Não consegui anotar a resposta.");
  return { stage: typeof answer?.stage === "string" ? answer.stage : "" };
}

/** Muda a etapa (só para frente). */
export async function moveStage(id: string, stage: string): Promise<void> {
  await post(`/prospects/${encodeURIComponent(id)}/stage`, { stage }, "Não consegui mudar a etapa.");
}

/** Apaga de vez os dados do negócio; o servidor pede a palavra APAGAR. */
export async function forgetProspect(id: string): Promise<void> {
  await post(`/prospects/${encodeURIComponent(id)}/forget`, { confirm: "APAGAR" }, "Não consegui apagar os dados.");
}
