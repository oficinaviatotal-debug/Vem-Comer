import { useCallback, useEffect, useRef, useState } from "react";
import { SESSION_EXPIRED_EVENT, SESSION_REFRESH_MS, getToken, getUser, logout, refreshSession } from "../service/api";

export type SessionUser = { id: string; name: string; email: string; role: string };

/**
 * Quem está dentro do painel. O login dura 8 horas no servidor; enquanto o painel está aberto ele se renova sozinho (e
 * ao voltar de um celular que dormiu), para ninguém sair no meio do turno. Se o login acabar, qualquer tela percebe e a
 * entrada volta com o e-mail já preenchido e um aviso que diz que não foi erro da pessoa.
 */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(() => (getToken() ? getUser() : null));
  const [ended, setEnded] = useState(false);
  const lastEmail = useRef(user?.email ?? "");
  if (user?.email) lastEmail.current = user.email;

  useEffect(() => {
    function onExpired() {
      setUser(null);
      setEnded(true);
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    void refreshSession();
    const timer = window.setInterval(() => void refreshSession(), SESSION_REFRESH_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void refreshSession();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn]);

  /** Chamado logo depois de `login()` dar certo: o servidor já gravou o login neste aparelho. */
  const enter = useCallback(() => {
    setUser(getUser());
    setEnded(false);
  }, []);

  const leave = useCallback(() => {
    logout();
    setUser(null);
    setEnded(false);
  }, []);

  return { user, ended, lastEmail: lastEmail.current, enter, leave };
}
