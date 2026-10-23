import { useEffect, useRef, useState } from "react";
import Login from "../novo/Login";
import { login } from "../service/api";
import { rememberCompany } from "../service/lastCompany";
import { loginCheck, loginFailText, loginViewOf } from "./loginLogic";

type Props = {
  /** O nome do restaurante, quando já se sabe. */
  place?: string;
  /** O endereço do restaurante (`?empresa=`): o aparelho lembra dele para abrir direto da próxima vez. */
  slug: string;
  /** O e-mail da última pessoa que estava dentro (o login acabou no meio do trabalho): já vem preenchido. */
  email?: string;
  /** O login acabou enquanto a pessoa usava o painel. */
  ended?: boolean;
  /** O servidor aceitou: o login já está gravado neste aparelho. */
  onSignedIn: () => void;
  onBack: () => void;
};

/**
 * A entrada do painel de verdade: confere o que foi escrito antes de incomodar o servidor, entra, e diz o que houve
 * quando não entra. "Senha errada" só aparece quando o servidor respondeu que está errada; sem sinal e servidor com
 * defeito têm frase própria. Um toque por vez: enquanto entra, o botão espera.
 */
export default function LoginScreen({ place, slug, email: remembered = "", ended = false, onSignedIn, onBack }: Props) {
  const [email, setEmail] = useState(remembered);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [field, setField] = useState<"email" | "password" | null>(null);
  const working = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function edited(name: "email" | "password") {
    // Mexeu no campo do problema (ou o problema era de conexão): a frase velha sai de cena.
    if (problem && (field === null || field === name)) {
      setProblem("");
      setField(null);
    }
  }

  async function submit() {
    if (working.current) return;
    const check = loginCheck({ email, password });
    if (!check.ok) {
      setProblem(check.text);
      setField(check.field);
      return;
    }
    working.current = true;
    setBusy(true);
    setProblem("");
    setField(null);
    try {
      await login(check.email, check.password);
      rememberCompany(slug);
      onSignedIn();
    } catch (failure) {
      if (!alive.current) return;
      setProblem(loginFailText(failure));
      const status = typeof failure === "object" && failure !== null && "status" in failure ? Number((failure as { status: unknown }).status) : 0;
      setField(status >= 400 && status < 500 ? "password" : null);
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <Login
      view={loginViewOf({ place, email, password, showPassword: show, busy, problem, problemField: field, ended })}
      onEmail={(value) => {
        edited("email");
        setEmail(value);
      }}
      onPassword={(value) => {
        edited("password");
        setPassword(value);
      }}
      onToggleShow={() => setShow((old) => !old)}
      onSubmit={() => void submit()}
      onBack={onBack}
    />
  );
}
