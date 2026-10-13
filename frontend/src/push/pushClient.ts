/**
 * O lado do navegador do aviso no celular: registrar o "robô" (public/sw.js), pedir licença e se inscrever.
 * Só funciona num navegador de verdade; as contas e os textos estão em pushLogic.ts, que tem teste.
 */
import { removeSubscription, sendSubscription } from "./pushApi";
import { sameKey, subscriptionBody, urlBase64ToBytes, type Permission, type Support } from "./pushLogic";

export const WORKER_URL = "/sw.js";

export function readSupport(): Support {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const ua = nav?.userAgent ?? "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
  const standalone =
    (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
    (nav as unknown as { standalone?: boolean } | undefined)?.standalone === true;
  return {
    secure: typeof window !== "undefined" && window.isSecureContext === true,
    serviceWorker: Boolean(nav && "serviceWorker" in nav),
    pushManager: typeof window !== "undefined" && "PushManager" in window,
    notification: typeof window !== "undefined" && "Notification" in window,
    ios,
    standalone,
  };
}

export function readPermission(): Permission {
  return typeof Notification === "undefined" ? "default" : Notification.permission;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return (await navigator.serviceWorker.getRegistration(WORKER_URL)) ?? (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

/** A inscrição que este celular já tem (ou null). */
export async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await registration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

/**
 * A inscrição só vale se foi feita com a chave do servidor de hoje. Se o banco do servidor foi refeito, a chave é outra
 * e os avisos dessa inscrição velha seriam recusados pelo serviço de notificação: melhor tratar como desligado e pedir
 * para ativar de novo (enablePush troca a inscrição).
 */
export async function validSubscription(serverKey: string): Promise<PushSubscription | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  return sameKey(subscription.options.applicationServerKey, urlBase64ToBytes(serverKey)) ? subscription : null;
}

export type EnableResult = { kind: "ok" } | { kind: "denied" };

/** Tocou em "Ativar aviso": pede licença, inscreve o celular e entrega ao servidor. Erros de rede sobem para a tela. */
export async function enablePush(companyId: string, serverKey: string): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { kind: "denied" };

  const wanted = urlBase64ToBytes(serverKey);
  const reg = await navigator.serviceWorker.register(WORKER_URL);
  await navigator.serviceWorker.ready;

  let subscription = await reg.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, wanted)) {
    // inscrito com outra chave do servidor (o banco foi refeito): a inscrição velha não serve mais
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: wanted as unknown as BufferSource,
    });
  }

  const body = subscriptionBody(subscription.toJSON());
  if (!body) throw new Error("Este navegador não entregou os dados do aviso.");
  await sendSubscription(companyId, body);
  return { kind: "ok" };
}

/** Quem entrou de novo neste celular passa a ser o dono da inscrição. Silencioso: se falhar, o aviso ligado continua. */
export async function refreshPush(companyId: string, serverKey: string): Promise<void> {
  try {
    if (readPermission() !== "granted") return;
    const subscription = await validSubscription(serverKey);
    const body = subscription ? subscriptionBody(subscription.toJSON()) : null;
    if (body) await sendSubscription(companyId, body);
  } catch {
    /* sem sinal agora: tenta na próxima vez que o painel abrir */
  }
}

/** Desliga neste celular: avisa o servidor primeiro e depois solta a inscrição do navegador. */
export async function disablePush(companyId: string): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await removeSubscription(companyId, subscription.endpoint);
  await subscription.unsubscribe();
}
