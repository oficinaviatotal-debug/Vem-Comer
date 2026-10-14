import { useEffect, useState } from "react";
import "../ui.css";
import "../admin.css";
import "../plan.css";
import "./help.css";
import { answerTitular, eraseByEmail, fetchTitularList, type EraseResult, type EraseScope } from "./titularApi";
import {
  ANSWER_OPTIONS,
  CAN_ERASE_KINDS,
  ERASE_WORD,
  RESPONSE_MAX,
  answerProblem,
  contactLink,
  deadlineText,
  deadlineTone,
  eraseConfirmed,
  listHeadline,
  safeHttpUrl,
  type AnswerStatus,
  type TitularItem,
  type TitularList,
} from "./titularLogic";

type Load = "loading" | "ready" | "error";

type Draft = { status: AnswerStatus; response: string; verified: boolean };

const blankDraft = (): Draft => ({ status: "respondida", response: "", verified: false });

/**
 * "Pedidos de dados e denúncias", só para os logins do administrador (o servidor decide quem): quem pediu para ver,
 * corrigir ou apagar os seus dados, e as denúncias de conteúdo, do prazo mais curto para o mais longo. O prazo da lei
 * é de 15 dias; a meta para denúncia é de 2 dias. Eliminar apaga só o que é pessoal e guarda valores e datas.
 */
export default function TitularInbox() {
  const [load, setLoad] = useState<Load>("loading");
  const [data, setData] = useState<TitularList | null>(null);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [scope, setScope] = useState<Record<string, EraseScope>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, EraseResult>>({});

  async function open() {
    setLoad("loading");
    setError("");
    try {
      setData(await fetchTitularList());
      setLoad("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui abrir a caixa de pedidos.");
      setLoad("error");
    }
  }

  useEffect(() => {
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draftOf(id: string): Draft {
    return drafts[id] ?? blankDraft();
  }

  function change(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? blankDraft()), ...patch } }));
  }

  async function save(item: TitularItem) {
    const draft = draftOf(item.id);
    const problem = answerProblem(draft.status, draft.response);
    if (problem) {
      setError(problem);
      return;
    }
    setWorking(item.id);
    setError("");
    try {
      await answerTitular(item.id, {
        status: draft.status,
        response: draft.response.trim(),
        identity_verified: draft.verified,
      });
      await open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui salvar a resposta.");
    } finally {
      setWorking(null);
    }
  }

  async function erase(item: TitularItem, execute: boolean) {
    if (!item.contact) return;
    setWorking(item.id);
    setError("");
    try {
      const result = await eraseByEmail({
        email: item.contact,
        escopo: scope[item.id] ?? "pessoa",
        request_id: item.id,
        ...(execute ? { confirmar: ERASE_WORD } : {}),
      });
      setPreview((current) => ({ ...current, [item.id]: result }));
      if (execute) setTyped((current) => ({ ...current, [item.id]: "" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui agora; nada foi alterado.");
    } finally {
      setWorking(null);
    }
  }

  if (load === "loading" && !data) {
    return (
      <section className="sheet plan help-inbox" aria-label="Pedidos de dados e denúncias">
        <h2>Pedidos de dados e denúncias</h2>
        <p className="adm-muted" role="status">
          Abrindo a caixa…
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="sheet plan help-inbox" aria-label="Pedidos de dados e denúncias">
        <h2>Pedidos de dados e denúncias</h2>
        <p className="msg-error" role="alert">
          {error}
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void open()}>
          Tentar de novo
        </button>
      </section>
    );
  }

  return (
    <section className="sheet plan help-inbox" aria-label="Pedidos de dados e denúncias">
      <h2>Pedidos de dados e denúncias</h2>
      <p className="plan-summary">
        <strong>{listHeadline(data)}</strong>
      </p>
      <p className="adm-muted">
        Prazo da lei para pedidos de dados: 15 dias. Meta para denúncia: 2 dias. Antes de entregar ou apagar dado,
        confira que o pedido é mesmo da pessoa.
      </p>
      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}

      {data.items.length === 0 ? (
        <p className="adm-muted">Ninguém pediu nada agora.</p>
      ) : (
        <ul className="plan-list">
          {data.items.map((item) => {
            const draft = draftOf(item.id);
            const contact = contactLink(item.contact);
            const target = safeHttpUrl(item.target_url);
            const tone = deadlineTone(item);
            const shown = preview[item.id];
            const canErase = CAN_ERASE_KINDS.includes(item.kind) && Boolean(item.contact);
            return (
              <li key={item.id} className={`plan-co plan-${tone === "ok" ? "warn" : tone}`}>
                <div className="plan-co-head">
                  <strong>{item.kind_label}</strong>
                  <span className="chip chip-wait">{deadlineText(item)}</span>
                </div>
                <p className="adm-muted plan-co-meta">
                  {item.protocol} · {item.identity_verified ? "pedido feito com login" : "identidade ainda não conferida"}
                  {" · "}
                  {item.status === "em_analise" ? "em análise" : "recebido"}
                </p>
                {item.contact && (
                  <p>
                    Contato:{" "}
                    {contact ? (
                      <a href={contact.href} target="_blank" rel="noreferrer">
                        {contact.label}
                      </a>
                    ) : (
                      item.contact
                    )}
                  </p>
                )}
                {item.target_url && (
                  <p>
                    Onde está:{" "}
                    {target ? (
                      <a href={target} target="_blank" rel="noreferrer noopener">
                        {target}
                      </a>
                    ) : (
                      item.target_url
                    )}
                  </p>
                )}
                {item.description && <p className="help-note">{item.description}</p>}

                <label className="field">
                  <span>O que fazer</span>
                  <select
                    value={draft.status}
                    onChange={(event) => change(item.id, { status: event.target.value as AnswerStatus })}
                  >
                    {ANSWER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Resposta para a pessoa</span>
                  <textarea
                    rows={3}
                    maxLength={RESPONSE_MAX}
                    value={draft.response}
                    onChange={(event) => change(item.id, { response: event.target.value })}
                  />
                </label>
                {!item.identity_verified && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.verified}
                      onChange={(event) => change(item.id, { verified: event.target.checked })}
                    />
                    <span>Conferi que o pedido é da própria pessoa</span>
                  </label>
                )}
                <div className="plan-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={working === item.id}
                    onClick={() => void save(item)}
                  >
                    {working === item.id ? "Salvando…" : "Salvar"}
                  </button>
                </div>

                {canErase && (
                  <div className="help-note">
                    <p>
                      <strong>Apagar os dados desta pessoa.</strong> Fica só o que a lei manda guardar (valores, datas e
                      pagamentos). Não dá para desfazer.
                    </p>
                    <label className="field">
                      <span>O que apagar</span>
                      <select
                        value={scope[item.id] ?? "pessoa"}
                        onChange={(event) =>
                          setScope((current) => ({ ...current, [item.id]: event.target.value as EraseScope }))
                        }
                      >
                        <option value="pessoa">Só esta pessoa</option>
                        <option value="restaurante">O restaurante inteiro (só se for o dono)</option>
                      </select>
                    </label>
                    <div className="plan-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={working === item.id}
                        onClick={() => void erase(item, false)}
                      >
                        Simular (não altera nada)
                      </button>
                    </div>
                    {shown && (
                      <p role="status">
                        {shown.executado ? "Feito. " : "Simulação: "}
                        {shown.alvo
                          ? `${shown.alvo.name_hint} (${shown.alvo.role}) do restaurante ${shown.alvo.company_name}. `
                          : ""}
                        {Object.entries(shown.contagem)
                          .map(([name, count]) => `${name}: ${count}`)
                          .join(", ")}
                        .
                      </p>
                    )}
                    {shown && !shown.executado && (
                      <>
                        <label className="field">
                          <span>
                            Para apagar de verdade, digite {ERASE_WORD}
                          </span>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCapitalize="characters"
                            value={typed[item.id] ?? ""}
                            onChange={(event) => setTyped((current) => ({ ...current, [item.id]: event.target.value }))}
                          />
                        </label>
                        <div className="plan-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={working === item.id || !eraseConfirmed(typed[item.id] ?? "")}
                            onClick={() => void erase(item, true)}
                          >
                            Apagar de verdade
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
