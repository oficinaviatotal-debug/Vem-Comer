import { useEffect, useState, type FormEvent } from "react";
import "../ui.css";
import "../admin.css";
import "./signup.css";
import { fetchSignupStatus, signupRestaurant, SignupFailure } from "../service/api";
import { rememberCompany } from "../service/lastCompany";
import { ownerLoginUrl, panelUrl, termsUrl } from "../service/links";
import {
  EMAIL_MAX,
  EMPTY_FORM,
  OWNER_NAME_MAX,
  PASSWORD_MAX,
  RESTAURANT_NAME_MAX,
  asSignupField,
  fallbackMessage,
  firstErrorField,
  formatPhoneInput,
  toRequestBody,
  validateSignup,
  type FieldErrors,
  type SignupField,
  type SignupForm,
} from "./signupLogic";

type Availability = "loading" | "open" | "closed" | "offline";

function focusField(field: SignupField) {
  document.getElementById(`signup-${field}`)?.focus();
}

/**
 * Cadastro do restaurante pela internet. Um formulário curto, em uma tela, com campos grandes.
 * Quando termina, o dono já está entrado e cai no painel, que abre o Assistente do cardápio.
 */
export default function SignupPage() {
  const [availability, setAvailability] = useState<Availability>("loading");
  const [form, setForm] = useState<SignupForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  // armadilha de robô: gente nunca vê nem preenche este campo
  const [honey, setHoney] = useState("");

  function checkAvailability() {
    setAvailability("loading");
    fetchSignupStatus().then(setAvailability);
  }

  useEffect(() => {
    let alive = true;
    fetchSignupStatus().then((status) => {
      if (alive) setAvailability(status);
    });
    return () => {
      alive = false;
    };
  }, []);

  function setField<K extends keyof SignupForm>(key: K, value: SignupForm[K], field: SignupField) {
    setForm((current) => ({ ...current, [key]: value }));
    // quem começa a corrigir não precisa ver o erro antigo
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;

    setFormError("");
    const found = validateSignup(form);
    setErrors(found);
    const first = firstErrorField(found);
    if (first) {
      focusField(first);
      return;
    }

    setSending(true);
    try {
      const company = await signupRestaurant(toRequestBody(form, honey));
      rememberCompany(company.slug);
      window.location.assign(panelUrl(window.location.origin, window.location.pathname, company.slug));
    } catch (error) {
      setSending(false);
      if (error instanceof SignupFailure) {
        const message = error.message || fallbackMessage(error.status);
        const field = asSignupField(error.field);
        if (field) {
          setErrors({ [field]: message });
          focusField(field);
        } else {
          setFormError(message);
        }
      } else {
        setFormError(fallbackMessage(0));
      }
    }
  }

  function fieldProps(field: SignupField) {
    return {
      id: `signup-${field}`,
      "aria-invalid": errors[field] ? (true as const) : undefined,
      "aria-describedby": errors[field] ? `signup-${field}-error` : undefined,
    };
  }

  // Dentro do campo é um <small> (um <label> só aceita texto corrido); solto na ficha é um <p>.
  function fieldError(field: SignupField, inside = true) {
    const message = errors[field];
    if (!message) return null;
    const props = { className: "msg-error signup-error", id: `signup-${field}-error`, role: "alert" };
    return inside ? <small {...props}>{message}</small> : <p {...props}>{message}</p>;
  }

  const logo = <img className="adm-login-logo" src="/logo-vem-comer.png" alt="Vem Comer" />;
  const loginLink = (
    <a className="btn btn-quiet" href={ownerLoginUrl(window.location.origin, window.location.pathname)}>
      Já tenho cadastro: entrar
    </a>
  );

  if (availability === "loading") {
    return (
      <main className="adm adm-login-page">
        <p className="adm-status" role="status">
          Carregando…
        </p>
      </main>
    );
  }

  if (availability === "offline") {
    return (
      <main className="adm adm-login-page">
        <section className="adm-login sheet signup">
          {logo}
          <p className="msg-error" role="alert">
            {fallbackMessage(0)}
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={checkAvailability}>
            Tentar de novo
          </button>
        </section>
      </main>
    );
  }

  if (availability === "closed") {
    return (
      <main className="adm adm-login-page">
        <section className="adm-login sheet signup">
          {logo}
          <div>
            <h1 className="adm-title">Cadastro ainda fechado</h1>
            <p className="adm-lead">
              O cadastro de restaurantes pela internet ainda não foi aberto. Se você já tem cadastro, é só
              entrar.
            </p>
          </div>
          {loginLink}
        </section>
      </main>
    );
  }

  return (
    <main className="adm adm-login-page">
      <form className="adm-login sheet signup" onSubmit={handleSubmit} noValidate>
        {logo}

        <div>
          <h1 className="adm-title">Cadastre seu restaurante</h1>
          <p className="adm-lead">
            Leva 1 minuto. Depois você monta o cardápio falando ou tocando na tela.
          </p>
        </div>

        <label className={errors.restaurant_name ? "field has-error" : "field"}>
          <span>Nome do restaurante</span>
          <input
            {...fieldProps("restaurant_name")}
            type="text"
            autoComplete="organization"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={RESTAURANT_NAME_MAX}
            placeholder="Ex.: Saiteria do João"
            value={form.restaurantName}
            onChange={(e) => setField("restaurantName", e.target.value, "restaurant_name")}
          />
          {fieldError("restaurant_name")}
        </label>

        <label className={errors.owner_name ? "field has-error" : "field"}>
          <span>Seu nome</span>
          <input
            {...fieldProps("owner_name")}
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={OWNER_NAME_MAX}
            value={form.ownerName}
            onChange={(e) => setField("ownerName", e.target.value, "owner_name")}
          />
          {fieldError("owner_name")}
        </label>

        <label className={errors.email ? "field has-error" : "field"}>
          <span>Seu e-mail (é com ele que você entra)</span>
          <input
            {...fieldProps("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={EMAIL_MAX}
            placeholder="nome@gmail.com"
            value={form.email}
            onChange={(e) => setField("email", e.target.value, "email")}
          />
          {fieldError("email")}
        </label>

        <label className={errors.phone ? "field has-error" : "field"}>
          <span>WhatsApp (se quiser)</span>
          <input
            {...fieldProps("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            placeholder="(84) 99999-1234"
            value={form.phone}
            onChange={(e) => setField("phone", formatPhoneInput(e.target.value), "phone")}
          />
          <small>Só para a gente falar com você sobre o seu cadastro.</small>
          {fieldError("phone")}
        </label>

        <div className={errors.password ? "field has-error" : "field"}>
          <span id="signup-password-label">Crie uma senha (mínimo 8)</span>
          <div className="signup-password">
            <input
              {...fieldProps("password")}
              aria-labelledby="signup-password-label"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={PASSWORD_MAX}
              value={form.password}
              onChange={(e) => setField("password", e.target.value, "password")}
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
          {fieldError("password")}
        </div>

        <label className="signup-terms">
          <input
            {...fieldProps("accept_terms")}
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(e) => setField("acceptTerms", e.target.checked, "accept_terms")}
          />
          <span>
            Li e aceito os{" "}
            <a href={termsUrl(window.location.origin, window.location.pathname)} target="_blank" rel="noopener">
              termos de uso
            </a>
            .
          </span>
        </label>
        {fieldError("accept_terms", false)}

        <p className="signup-honey" aria-hidden="true">
          <label>
            Não preencha este campo
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honey}
              onChange={(e) => setHoney(e.target.value)}
            />
          </label>
        </p>

        {formError && (
          <p className="msg-error" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? "Criando…" : "Criar meu restaurante"}
        </button>
        <p className="signup-sub">Sem cobrança neste cadastro.</p>

        {loginLink}
      </form>
    </main>
  );
}
