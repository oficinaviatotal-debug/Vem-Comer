import { useEffect, useRef } from "react";
import {
  LOGIN_BACK,
  LOGIN_EMAIL_HINT,
  LOGIN_EMAIL_LABEL,
  LOGIN_HIDE,
  LOGIN_PASSWORD_LABEL,
  LOGIN_SHOW,
  LOGIN_SUBMIT,
  LOGIN_SUBMITTING,
  LOGIN_TITLE,
} from "./copy";
import { TopBar } from "./parts";
import type { LoginView } from "./types";

export type LoginHandlers = {
  onEmail?: (value: string) => void;
  onPassword?: (value: string) => void;
  onToggleShow?: () => void;
  onSubmit?: () => void;
  onBack?: () => void;
};

type Props = { view: LoginView } & LoginHandlers;

const BRAND_LOGO = "/logo-vem-comer.png";

/**
 * A entrada do painel: e-mail e senha. O foco vai para o campo certo: o e-mail quando está vazio, a senha quando o
 * login acabou e o e-mail já está preenchido, e o campo do problema quando algo deu errado. A senha pode ser mostrada
 * (quem digita no celular erra sem ver). Quem não é da casa volta ao cardápio com um toque.
 */
export default function Login({ view, onEmail, onPassword, onToggleShow, onSubmit, onBack }: Props) {
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const opened = useRef(false);

  // Ao abrir: o primeiro campo vazio. Em seguida, só quando aparece um problema, o campo dele.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    (view.email ? password : email).current?.focus();
  }, [view.email]);
  useEffect(() => {
    if (!view.problem) return;
    (view.problemField === "email" ? email : password).current?.focus();
  }, [view.problem, view.problemField]);

  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-login">
        <TopBar logo={BRAND_LOGO} title={LOGIN_TITLE} sub={view.place || view.lead} />
        <p className="nv-sr" id="nv-login-live" role="status" aria-live="polite">
          {view.live}
        </p>

        {view.place ? <p className="nv-code-hint">{view.lead}</p> : null}
        {view.notice ? (
          <p className="nv-ok" aria-hidden="true">
            {view.notice}
          </p>
        ) : null}

        <form
          className="nv-dishform"
          noValidate
          aria-label={LOGIN_TITLE}
          onSubmit={(event) => {
            event.preventDefault();
            if (!view.busy) onSubmit?.();
          }}
        >
          <div className="nv-dishform-field">
            <label className="nv-code-label" htmlFor="nv-login-email">
              {LOGIN_EMAIL_LABEL}
            </label>
            <div className="nv-field">
              <input
                ref={email}
                id="nv-login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={LOGIN_EMAIL_HINT}
                value={view.email}
                aria-invalid={view.problemField === "email" ? true : undefined}
                aria-describedby={view.problemField === "email" ? "nv-login-problem" : undefined}
                onChange={(event) => onEmail?.(event.target.value)}
              />
            </div>
          </div>

          <div className="nv-dishform-field">
            <label className="nv-code-label" htmlFor="nv-login-password">
              {LOGIN_PASSWORD_LABEL}
            </label>
            <div className="nv-field">
              <input
                ref={password}
                id="nv-login-password"
                type={view.showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                value={view.password}
                aria-invalid={view.problemField === "password" ? true : undefined}
                aria-describedby={view.problemField === "password" ? "nv-login-problem" : undefined}
                onChange={(event) => onPassword?.(event.target.value)}
              />
            </div>
            <button type="button" className="nv-link" aria-pressed={view.showPassword} onClick={onToggleShow}>
              {view.showPassword ? LOGIN_HIDE : LOGIN_SHOW}
            </button>
          </div>

          {view.problem ? (
            <p className="nv-error" id="nv-login-problem" role="alert">
              {view.problem}
            </p>
          ) : null}

          <button type="submit" className="nv-btn is-green is-block" disabled={view.busy} aria-busy={view.busy || undefined}>
            {view.busy ? LOGIN_SUBMITTING : LOGIN_SUBMIT}
          </button>
        </form>

        <button type="button" className="nv-btn is-ghost is-block" disabled={view.busy} onClick={onBack}>
          {LOGIN_BACK}
        </button>
      </main>
    </div>
  );
}
