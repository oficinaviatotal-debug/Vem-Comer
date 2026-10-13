/**
 * Aviso no celular (Web Push): as contas e os textos, sem tocar no navegador.
 * tests/push/pushLogic.test.mjs roda isto no Node. O que mexe no navegador fica em pushClient.ts.
 */

/** O que este navegador sabe fazer. Preenchido por pushClient.readSupport(). */
export type Support = {
  secure: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  ios: boolean;
  /** Aberto pelo ícone da tela inicial (o iPhone só avisa assim). */
  standalone: boolean;
};

export type Permission = "default" | "granted" | "denied";

/** "checking": ainda perguntando ao servidor. "hidden": o servidor não liga o aviso. */
export type PushStatus = "checking" | "hidden" | "unsupported" | "off" | "blocked" | "on";

export const TEXT = {
  title: "Aviso no celular",
  pitch: "Ative para saber de pedido novo, mesa chamando e entrega pronta mesmo com o app fechado.",
  activate: "Ativar aviso",
  activating: "Ativando…",
  later: "Agora não",
  test: "Testar aviso",
  testing: "Enviando…",
  turnOff: "Desligar",
  turningOff: "Desligando…",
  on: "Aviso no celular ligado.",
  blocked:
    "As notificações estão bloqueadas neste navegador. Toque no cadeado ao lado do endereço do site, abra Permissões e libere Notificações. Depois volte aqui.",
  denied: "Sem a sua permissão o aviso não liga. Toque em Ativar aviso e escolha Permitir.",
  noSignal: "Sem sinal. Tente de novo.",
  activated: "Pronto! Este celular vai receber os avisos. Toque em Testar aviso para conferir.",
  turnedOff: "Aviso desligado neste celular.",
} as const;

/** Vazio quando dá para ligar; senão, o que falta, em palavras simples. */
export function supportProblem(support: Support): string {
  if (!support.secure) return "O aviso só funciona no endereço seguro (https).";
  if (support.ios && !support.standalone) {
    return "No iPhone, toque em Compartilhar, escolha Adicionar à Tela de Início e abra o Vem Comer por esse ícone. Depois ative o aviso.";
  }
  if (!support.serviceWorker || !support.pushManager || !support.notification) {
    return "Este navegador não recebe aviso. No Android, use o Chrome.";
  }
  return "";
}

export function pushStatus(input: {
  serverEnabled: boolean | null;
  support: Support;
  permission: Permission;
  subscribed: boolean;
}): PushStatus {
  if (input.serverEnabled === null) return "checking";
  if (!input.serverEnabled) return "hidden";
  if (supportProblem(input.support)) return "unsupported";
  if (input.permission === "denied") return "blocked";
  if (input.permission === "granted" && input.subscribed) return "on";
  return "off";
}

/** A chave pública do servidor chega em base64 "de URL"; o navegador quer os bytes. */
export function urlBase64ToBytes(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type SubscriptionBody = { endpoint: string; keys: { p256dh: string; auth: string } };

/** O que o servidor recebe, tirado do PushSubscription.toJSON(); null se faltar algo. */
export function subscriptionBody(json: unknown): SubscriptionBody | null {
  if (!json || typeof json !== "object") return null;
  const { endpoint, keys } = json as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || !endpoint || !keys || typeof keys !== "object") return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (typeof p256dh !== "string" || typeof auth !== "string" || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

/** A inscrição que o celular já tem foi feita com a mesma chave do servidor? Se a chave mudou, é preciso inscrever de novo. */
export function sameKey(current: ArrayBuffer | ArrayBufferView | null | undefined, wanted: Uint8Array): boolean {
  if (!current) return false;
  const bytes = ArrayBuffer.isView(current)
    ? new Uint8Array(current.buffer, current.byteOffset, current.byteLength)
    : new Uint8Array(current);
  if (bytes.length !== wanted.length) return false;
  for (let i = 0; i < bytes.length; i += 1) if (bytes[i] !== wanted[i]) return false;
  return true;
}

export type TestResult = { sent: number; removed: number; failed: number };

export function normalizeTestResult(raw: unknown): TestResult {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
  return { sent: count(data.sent), removed: count(data.removed), failed: count(data.failed) };
}

export function testText(result: TestResult): string {
  if (result.sent > 0) {
    const where = result.sent === 1 ? "1 celular" : `${result.sent} celulares`;
    return `Aviso enviado para ${where}. Se não apareceu, veja se o celular não está no modo silencioso.`;
  }
  if (result.removed > 0) return "O serviço de aviso disse que este celular saiu da lista. Toque em Ativar aviso de novo.";
  if (result.failed > 0) return "O serviço de aviso não respondeu agora. Tente de novo daqui a pouco.";
  return "Nenhum celular ativado nesta conta. Toque em Ativar aviso.";
}

/** "Agora não" vale por uma semana. */
export const DISMISS_DAYS = 7;

export function dismissedRecently(storedAt: string | null, now: number): boolean {
  if (!storedAt) return false;
  const at = Number(storedAt);
  if (!Number.isFinite(at) || at <= 0 || at > now) return false;
  return now - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}
