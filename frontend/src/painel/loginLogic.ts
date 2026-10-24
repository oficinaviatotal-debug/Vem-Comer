/**
 * A entrada do painel, versão nova: o que a tela diz a quem vai entrar. Só conta, sem React nem rede:
 * tests/novo/loginLogic.test.mjs roda isto no Node.
 *
 * Honestidade: a frase do servidor passa como veio só quando é erro de quem digitou (400 a 499); falta de sinal e
 * erro do servidor usam a nossa, que diz o que fazer. Nunca se chama de "senha errada" um pedido que nem chegou.
 */
import {
  LOGIN_BAD_EMAIL,
  LOGIN_ENDED,
  LOGIN_LEAD,
  LOGIN_NO_EMAIL,
  LOGIN_NO_PASSWORD,
  LOGIN_OFFLINE,
  LOGIN_SERVER,
  LOGIN_TOO_MANY,
  LOGIN_WRONG,
} from "../novo/copy.ts";
import type { LoginView } from "../novo/types.ts";

export type LoginForm = { email: string; password: string };

export type LoginCheck = { ok: true; email: string; password: string } | { ok: false; field: "email" | "password"; text: string };

/** O e-mail perde os espaços das pontas (o teclado do celular põe um depois do que se digita). A senha não é mexida. */
export function loginCheck(form: LoginForm): LoginCheck {
  const email = form.email.trim();
  if (!email) return { ok: false, field: "email", text: LOGIN_NO_EMAIL };
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return { ok: false, field: "email", text: LOGIN_BAD_EMAIL };
  if (!form.password) return { ok: false, field: "password", text: LOGIN_NO_PASSWORD };
  return { ok: true, email, password: form.password };
}

/** O que o servidor respondeu, em número; 0 quando o pedido nem chegou. */
function statusOf(error: unknown): number {
  if (typeof error !== "object" || error === null || !("status" in error)) return 0;
  const status = Number((error as { status: unknown }).status);
  return Number.isFinite(status) ? status : 0;
}

/** A frase do problema da entrada. */
export function loginFailText(error: unknown): string {
  const status = statusOf(error);
  const message = error instanceof Error ? error.message.trim() : "";
  if (status === 0) return LOGIN_OFFLINE;
  if (status >= 500) return LOGIN_SERVER;
  if (status === 429) return message || LOGIN_TOO_MANY;
  return message || LOGIN_WRONG;
}

export type LoginInput = {
  place: string | null | undefined;
  email: string;
  password: string;
  showPassword: boolean;
  busy: boolean;
  problem: string;
  problemField: "email" | "password" | null;
  /** O login acabou enquanto a pessoa usava o painel. */
  ended: boolean;
};

export function loginViewOf(input: LoginInput): LoginView {
  const place = (input.place ?? "").trim();
  // O aviso de "acesso terminou" some quando há um problema de verdade para dizer: uma frase de cada vez.
  const notice = input.ended && !input.problem ? LOGIN_ENDED : "";
  return {
    place,
    lead: LOGIN_LEAD,
    notice,
    problem: input.problem,
    problemField: input.problem ? input.problemField : null,
    email: input.email,
    password: input.password,
    showPassword: input.showPassword,
    busy: input.busy,
    // O problema é lido pelo próprio alerta da tela; aqui só o aviso, para a mesma frase não ser lida duas vezes.
    live: notice,
  };
}
