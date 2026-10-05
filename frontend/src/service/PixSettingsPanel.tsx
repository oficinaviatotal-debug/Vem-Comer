import { useEffect, useRef, useState } from "react";
import {
  fetchPixPreview,
  fetchPixSettings,
  removePixSettings,
  savePixSettings,
  type PixCode,
  type PixSettings,
} from "./api";
import { copyText } from "./clipboard";
import ConfirmButton from "./ConfirmButton";
import { formatMoney } from "./format";
import { keyPlaceholder, keyTypeLabel, pixFormProblem, PIX_KEY_TYPES, removeProblem } from "./pixSettings";

type Props = {
  companyId: string;
  /** Only the owner changes where the money goes. A manager can look and test. */
  canEdit: boolean;
};

/** "Pagamento" tab: the restaurant's own Pix key, a R$ 1,00 test code, and the off switch. */
export default function PixSettingsPanel({ companyId, canEdit }: Props) {
  const [settings, setSettings] = useState<PixSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [keyType, setKeyType] = useState("cpf");
  const [key, setKey] = useState("");
  const [receiver, setReceiver] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [test, setTest] = useState<PixCode | null>(null);
  const [testError, setTestError] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [copied, setCopied] = useState<"" | "ok" | "manual">("");
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    fetchPixSettings(companyId)
      .then((found) => {
        if (!alive) return;
        setSettings(found);
        if (found.configured) {
          setKeyType(found.key_type || "cpf");
          setReceiver(found.receiver_name || "");
          setCity(found.city || "");
        }
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [companyId]);

  async function save() {
    setError("");
    setSaved("");
    const problem = pixFormProblem({
      key_type: keyType,
      key,
      receiver_name: receiver,
      city,
      password,
    });
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const next = await savePixSettings(companyId, {
        key_type: keyType,
        key,
        receiver_name: receiver,
        city,
        password,
      });
      setSettings(next);
      setReceiver(next.receiver_name || receiver);
      setCity(next.city || city);
      setKey("");
      setPassword("");
      setTest(null);
      setSaved("Pix salvo. Agora o cliente vê o código Pix no pedido. Faça um teste de R$ 1,00 antes de usar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o Pix");
    } finally {
      setSaving(false);
    }
  }

  async function turnOff() {
    setError("");
    setSaved("");
    const problem = removeProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const next = await removePixSettings(companyId, password);
      setSettings(next);
      setKey("");
      setPassword("");
      setTest(null);
      setSaved("Pix desligado. O cliente vê só Cartão e Dinheiro.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desligar o Pix");
    }
  }

  async function showTest() {
    setTestError("");
    setCopied("");
    setTestBusy(true);
    try {
      setTest(await fetchPixPreview(companyId));
    } catch (err) {
      setTest(null);
      setTestError(err instanceof Error ? err.message : "Falha ao gerar o código de teste");
    } finally {
      setTestBusy(false);
    }
  }

  async function copyTest() {
    if (!test) return;
    setCopied((await copyText(test.payload, field.current)) ? "ok" : "manual");
  }

  if (loadFailed) {
    return (
      <p className="adm-status" role="alert">
        Não foi possível abrir esta tela. Confira a internet e tente de novo.
      </p>
    );
  }

  if (!settings) {
    return <p className="adm-status">Carregando…</p>;
  }

  const on = settings.configured;

  return (
    <section className="adm-stack" aria-label="Pagamento">
      <div className="sheet">
        <h2>Receber pelo Pix</h2>
        <p className="adm-lead">
          O cliente paga direto na sua conta, sem taxa do Vem Comer. Você escreve a sua chave Pix uma vez e o código
          aparece no pedido dele, com o valor certo.
        </p>

        <p className={on ? "adm-pix-state is-on" : "adm-pix-state"} id="admin-pix-state">
          {on ? (
            <>
              <strong>Pix ligado</strong>
              <span>
                Chave {keyTypeLabel(settings.key_type)}: {settings.key_masked}
              </span>
              <span>
                Recebedor: {settings.receiver_name}, {settings.city}
              </span>
            </>
          ) : (
            <>
              <strong>Pix desligado</strong>
              <span>O cliente vê só Cartão e Dinheiro.</span>
            </>
          )}
        </p>

        <p className="adm-muted">
          Quando o dinheiro cair na sua conta, toque em Pagamento recebido no pedido. O sistema não vê o seu banco.
        </p>
      </div>

      {canEdit ? (
        <form
          className="sheet"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2>{on ? "Trocar a chave Pix" : "Ligar o Pix"}</h2>

          <label className="field">
            <span>Tipo da chave</span>
            <select
              id="admin-pix-type"
              value={keyType}
              onChange={(event) => {
                setKeyType(event.target.value);
                setKey("");
              }}
            >
              {PIX_KEY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Chave Pix</span>
            <input
              id="admin-pix-key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={keyPlaceholder(keyType)}
              inputMode={keyType === "email" ? "email" : keyType === "random" ? "text" : "tel"}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>

          <label className="field">
            <span>Nome do recebedor</span>
            <input
              id="admin-pix-name"
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="Como aparece no seu banco"
            />
            <small>O cliente confere este nome antes de pagar. Usamos até 25 letras, sem acento.</small>
          </label>

          <label className="field">
            <span>Cidade</span>
            <input
              id="admin-pix-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={40}
              autoComplete="off"
              placeholder="Ex.: Natal"
            />
          </label>

          <label className="field">
            <span>Sua senha</span>
            <input
              id="admin-pix-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <small>Pedimos a senha de novo porque esta chave decide para onde vai o dinheiro.</small>
          </label>

          {error && (
            <p className="msg-error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="msg-ok" role="status">
              {saved}
            </p>
          )}

          <button type="submit" id="admin-pix-save" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? "Salvando…" : "Salvar Pix"}
          </button>

          {on && <ConfirmButton label="Desligar o Pix" onConfirm={() => void turnOff()} />}
        </form>
      ) : (
        <p className="adm-muted">Só o dono pode mudar a chave Pix.</p>
      )}

      {on && (
        <div className="sheet">
          <h2>Teste de R$ 1,00</h2>
          <p className="adm-lead">
            Gere um código de R$ 1,00, pague com o seu celular e veja se o dinheiro cai na sua conta e se o nome do
            recebedor está certo.
          </p>

          <button type="button" id="admin-pix-test" className="btn btn-outline btn-block" onClick={() => void showTest()} disabled={testBusy}>
            {testBusy ? "Gerando…" : "Ver código de teste"}
          </button>

          {testError && (
            <p className="msg-error" role="alert">
              {testError}
            </p>
          )}

          {test && (
            <div className="adm-pix-test">
              <div className="leader-row">
                <span>Valor do teste</span>
                <span className="leader" aria-hidden="true" />
                <span className="money">{formatMoney(test.amount)}</span>
              </div>
              <img src={test.qr_data_url} alt="QR code Pix de teste" width={200} height={200} />
              <button type="button" className="btn btn-primary btn-block" onClick={() => void copyTest()}>
                Copiar código de teste
              </button>
              <p className="adm-muted" role="status">
                {copied === "ok" && "Código copiado. Cole no app do seu banco."}
                {copied === "manual" && "Não deu para copiar sozinho. Toque e segure no código abaixo."}
              </p>
              <label className="field">
                <span>Código Pix Copia e Cola</span>
                <textarea
                  ref={field}
                  readOnly
                  rows={4}
                  value={test.payload}
                  onFocus={(event) => event.currentTarget.select()}
                  spellCheck={false}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
