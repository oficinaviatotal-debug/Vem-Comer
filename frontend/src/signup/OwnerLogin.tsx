import { useEffect, useState, type FormEvent } from "react";
import "../ui.css";
import "../admin.css";
import "./signup.css";
import { fetchCompany, fetchSignupStatus, login } from "../service/api";
import { rememberCompany } from "../service/lastCompany";
import { panelUrl, signupUrl } from "../service/links";

/**
 * Entrada do dono pelo endereço principal, sem precisar saber o link do restaurante:
 * e-mail e senha, e o sistema acha o restaurante dele e abre o painel.
 */
export default function OwnerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSignupStatus().then((status) => {
      if (alive) setSignupOpen(status === "open");
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setError("");

    if (!email.trim() || !password) {
      setError("Digite o e-mail e a senha.");
      return;
    }

    setSending(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      const company = await fetchCompany(user.company_id);
      rememberCompany(company.slug);
      window.location.assign(panelUrl(window.location.origin, window.location.pathname, company.slug));
    } catch (failure) {
      setSending(false);
      setError(
        failure instanceof TypeError
          ? "Sem internet agora. Tente de novo em instantes."
          : failure instanceof Error && failure.message
            ? failure.message
            : "Não foi possível entrar. Tente de novo."
      );
    }
  }

  return (
    <main className="adm adm-login-page">
      <form className="adm-login sheet signup" onSubmit={handleSubmit} noValidate>
        <img className="adm-login-logo" src="/logo-vem-comer.png" alt="Vem Comer" />

        <div>
          <h1 className="adm-title">Área do restaurante</h1>
          <p className="adm-lead">Entre com o e-mail e a senha do seu cadastro.</p>
        </div>

        <label className="field">
          <span>E-mail</span>
          <input
            id="owner-login-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="nome@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <div className="field">
          <span id="owner-login-password-label">Senha</span>
          <div className="signup-password">
            <input
              id="owner-login-password"
              aria-labelledby="owner-login-password-label"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? "Esconder" : "Mostrar"}
            </button>
          </div>
        </div>

        {error && (
          <p className="msg-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? "Entrando…" : "Entrar"}
        </button>

        {signupOpen && (
          <a className="btn btn-quiet" href={signupUrl(window.location.origin, window.location.pathname)}>
            Ainda não tenho cadastro
          </a>
        )}
      </form>
    </main>
  );
}
