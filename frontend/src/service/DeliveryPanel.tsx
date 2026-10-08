import { useEffect, useMemo, useRef, useState } from "react";
import "../ui.css";
import "../admin.css";
import "../delivery.css";
import { fetchAdminDelivery, saveAdminDelivery } from "./deliveryAdminApi";
import ConfirmButton from "./ConfirmButton";
import { canListen, hear, DICTATION_PATIENCE_MS, type Hearing } from "../assistant/voiceIO";
import { parseSpokenZones, SPOKEN_ZONES_HELP } from "./spokenZones";
import {
  LIMITS,
  blankZone,
  fromApi,
  mergeZones,
  sentence,
  toPayload,
  validate,
  type ApiDelivery,
  type Draft,
  type DraftZone,
} from "./deliveryDraft";

type Load = "loading" | "ready" | "error";

/** The regions as typed, without the screen ids: the same text on both sides means nothing to save. */
const snapshot = (zones: DraftZone[]) =>
  JSON.stringify(zones.map(({ id, name, ceps, fee, minOrder, eta, active }) => [id ?? "", name, ceps, fee, minOrder, eta, active]));

/**
 * Tab "Entrega": the regions the restaurant delivers to (name, start of the CEPs, fee, minimum order, time), the
 * pickup switch and the pause. The two switches save at once (a pause cannot wait); the regions are saved with the
 * button, after the owner checks what was typed or said.
 */
export default function DeliveryPanel() {
  const [load, setLoad] = useState<Load>("loading");
  const [draft, setDraft] = useState<Draft>({ acceptsPickup: true, paused: false, zones: [] });
  // What the server has: the switches save over this, never over regions still being edited
  const [server, setServer] = useState<ApiDelivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [spoken, setSpoken] = useState<{ said: string; lines: string[]; notes: string[] } | null>(null);
  const hearingRef = useRef<Hearing | null>(null);
  const heardRef = useRef("");
  const micAvailable = canListen();

  async function open() {
    setLoad("loading");
    try {
      const data = await fetchAdminDelivery();
      setDraft(fromApi(data));
      setServer(data);
      setLoad("ready");
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui abrir a entrega." });
      setLoad("error");
    }
  }

  useEffect(() => {
    void open();
  }, []);

  // Leaving the tab turns the microphone off
  useEffect(() => () => hearingRef.current?.cancel(), []);

  const dirty = useMemo(
    () => load === "ready" && server !== null && snapshot(draft.zones) !== snapshot(fromApi(server).zones),
    [draft.zones, server, load]
  );

  function change(zones: DraftZone[]) {
    setDraft((current) => ({ ...current, zones }));
    setProblems([]);
    setNotice(null);
  }

  const updateZone = (uid: string, patch: Partial<DraftZone>) =>
    change(draft.zones.map((zone) => (zone.uid === uid ? { ...zone, ...patch } : zone)));

  const addZone = () => {
    if (draft.zones.length >= LIMITS.zones) return;
    change([...draft.zones, blankZone()]);
  };

  /** A switch saves right away, with the regions the server already has (not the ones being edited). */
  async function flip(patch: { accepts_pickup?: boolean; delivery_paused?: boolean }) {
    if (!server || switching) return;
    setSwitching(true);
    setNotice(null);
    try {
      const saved = await saveAdminDelivery({
        accepts_pickup: patch.accepts_pickup ?? server.accepts_pickup,
        delivery_paused: patch.delivery_paused ?? server.delivery_paused,
        zones: server.zones,
      });
      setServer(saved);
      setDraft((current) => ({ ...current, acceptsPickup: saved.accepts_pickup, paused: saved.delivery_paused }));
      setNotice({
        ok: true,
        text:
          patch.delivery_paused === undefined
            ? saved.accepts_pickup
              ? "Retirada ligada. Os clientes já veem."
              : "Retirada desligada. Os clientes já veem."
            : saved.delivery_paused
              ? "Entrega pausada. Os clientes já veem."
              : "Entrega de volta. Os clientes já veem.",
      });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui mudar. Tente de novo." });
    } finally {
      setSwitching(false);
    }
  }

  /** What was said becomes regions on the screen. Nothing is saved: the owner checks and taps "Salvar regiões". */
  function understand(said: string) {
    const parsed = parseSpokenZones(said, draft.zones.map((zone) => zone.name));
    if (parsed.zones.length === 0) {
      setSpoken({ said, lines: [], notes: parsed.notes });
      return;
    }
    change(mergeZones(draft.zones, parsed.zones));
    setSpoken({ said, lines: parsed.lines, notes: parsed.notes });
  }

  async function listen() {
    if (hearingRef.current) return;
    setSpoken(null);
    setHeard("");
    heardRef.current = "";
    setListening(true);
    const hearing = hear({
      patienceMs: DICTATION_PATIENCE_MS,
      onPartial: (text) => {
        heardRef.current = text;
        setHeard(text);
      },
    });
    hearingRef.current = hearing;
    const said = await hearing.result;
    if (hearingRef.current !== hearing) return; // cancelled or replaced meanwhile
    hearingRef.current = null;
    setListening(false);
    understand((said ?? heardRef.current).trim());
  }

  /** "Pronto": use the words heard so far instead of waiting for the silence. */
  function finishListening() {
    const hearing = hearingRef.current;
    if (!hearing) return;
    hearingRef.current = null;
    hearing.cancel();
    setListening(false);
    understand(heardRef.current.trim());
  }

  function cancelListening() {
    hearingRef.current?.cancel();
    hearingRef.current = null;
    setListening(false);
    setHeard("");
  }

  async function save() {
    const found = validate(draft);
    if (found.length > 0) {
      setProblems(found);
      setNotice(null);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      // the switches are whatever the server has: they save on their own
      const payload = toPayload(draft);
      const saved = await saveAdminDelivery({
        ...payload,
        accepts_pickup: server?.accepts_pickup ?? payload.accepts_pickup,
        delivery_paused: server?.delivery_paused ?? payload.delivery_paused,
      });
      setServer(saved);
      setDraft(fromApi(saved));
      setProblems([]);
      setNotice({
        ok: true,
        text: saved.zones.length === 0 ? "Pronto. Você ficou sem regiões de entrega." : "Regiões salvas. Os clientes já veem.",
      });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui salvar. Tente de novo." });
    } finally {
      setSaving(false);
    }
  }

  if (load === "loading") {
    return (
      <section className="sheet dlv" aria-label="Entrega">
        <h2>Entrega</h2>
        <p className="adm-muted" role="status">
          Abrindo a entrega…
        </p>
      </section>
    );
  }

  if (load === "error") {
    return (
      <section className="sheet dlv" aria-label="Entrega">
        <h2>Entrega</h2>
        {notice && (
          <p className="msg-error" role="alert">
            {notice.text}
          </p>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void open()}>
          Tentar de novo
        </button>
      </section>
    );
  }

  const pickup = server?.accepts_pickup ?? draft.acceptsPickup;
  const paused = server?.delivery_paused ?? draft.paused;

  return (
    <section className="sheet dlv" aria-label="Entrega">
      <h2>Entrega</h2>
      <p className="adm-muted">
        O cliente digita o CEP; o sistema acha a região, soma a taxa ao pedido e confere o pedido mínimo.
      </p>

      <div className="dlv-switches">
        <div className="dlv-switch">
          <span>
            <strong>Retirada no local</strong>
            <small>{pickup ? "O cliente pode pedir e buscar." : "Desligada: o cliente não vê a retirada."}</small>
          </span>
          <button
            type="button"
            className={pickup ? "btn btn-outline btn-sm is-on" : "btn btn-outline btn-sm"}
            aria-pressed={pickup}
            disabled={switching}
            onClick={() => void flip({ accepts_pickup: !pickup })}
          >
            {pickup ? "Ligada" : "Desligada"}
          </button>
        </div>
        <div className="dlv-switch">
          <span>
            <strong>Pausar a entrega</strong>
            <small>
              {paused
                ? "Pausada: o cliente vê que hoje não entregamos. Pedido em andamento continua."
                : "Use quando a cozinha encher ou o motoqueiro faltar. Vale na hora."}
            </small>
          </span>
          <button
            type="button"
            className={paused ? "btn btn-outline btn-sm is-alert" : "btn btn-outline btn-sm"}
            aria-pressed={paused}
            disabled={switching}
            onClick={() => void flip({ delivery_paused: !paused })}
          >
            {paused ? "Voltar a entregar" : "Pausar agora"}
          </button>
        </div>
      </div>

      <h3>Regiões</h3>
      {draft.zones.length === 0 ? (
        <p className="adm-muted">
          {micAvailable
            ? "Você ainda não cadastrou regiões, então o cliente só vê a retirada. Fale ou toque em Adicionar região."
            : "Você ainda não cadastrou regiões, então o cliente só vê a retirada. Toque em Adicionar região."}
        </p>
      ) : (
        <p className="adm-muted">
          Cada região é o começo do CEP: 30110 cobre de 30110-000 a 30110-999. Quando dois começos servem, vale o mais
          comprido: 30110 ganha de 301.
        </p>
      )}

      {micAvailable &&
        (listening ? (
          <div className="dlv-listen" role="status" aria-live="polite">
            <strong>Estou ouvindo…</strong>
            <p>{heard || "Pode falar. Ex.: Centro, taxa 5, CEP 30110 e 30120, mínimo 20, prazo 40 minutos."}</p>
            <div className="dlv-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={finishListening}>
                Pronto
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={cancelListening}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-mata" onClick={() => void listen()}>
            <span aria-hidden="true">🎙️</span> Falar as regiões
          </button>
        ))}

      {spoken && !listening && (
        <div className="dlv-heard" role="status">
          {spoken.said && (
            <p>
              <strong>Você disse:</strong> “{spoken.said}”
            </p>
          )}
          {spoken.lines.length > 0 ? (
            <>
              <p>
                <strong>Entendi:</strong>
              </p>
              <ul>
                {spoken.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>Confira abaixo e toque em Salvar regiões. Ainda não foi salvo.</p>
            </>
          ) : (
            <p className="msg-error">
              {spoken.said ? "Não entendi nenhuma região." : "Não ouvi nada."} {SPOKEN_ZONES_HELP}
            </p>
          )}
          {spoken.notes.length > 0 && (
            <ul className="dlv-notes">
              {spoken.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setSpoken(null)}>
            Fechar aviso
          </button>
        </div>
      )}

      {draft.zones.map((zone, index) => (
        <section
          className={zone.active ? "dlv-zone" : "dlv-zone is-off"}
          key={zone.uid}
          aria-label={zone.name || `Região ${index + 1}`}
        >
          <label className="field">
            <span>Nome da região</span>
            <input
              value={zone.name}
              maxLength={LIMITS.name}
              placeholder="Ex.: Centro"
              onChange={(event) => updateZone(zone.uid, { name: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Começo dos CEPs</span>
            <input
              value={zone.ceps}
              inputMode="text"
              autoComplete="off"
              placeholder="Ex.: 30110, 30120"
              onChange={(event) => updateZone(zone.uid, { ceps: event.target.value })}
            />
            <small className="dlv-hint">Separe por vírgula. De 3 a 8 números cada um.</small>
          </label>

          <div className="dlv-money">
            <label className="field">
              <span>Taxa (R$)</span>
              <input
                value={zone.fee}
                inputMode="decimal"
                placeholder="0,00"
                onChange={(event) => updateZone(zone.uid, { fee: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Mínimo (R$)</span>
              <input
                value={zone.minOrder}
                inputMode="decimal"
                placeholder="0,00"
                onChange={(event) => updateZone(zone.uid, { minOrder: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Prazo (min)</span>
              <input
                value={zone.eta}
                inputMode="numeric"
                placeholder="40"
                onChange={(event) => updateZone(zone.uid, { eta: event.target.value.replace(/\D/g, "").slice(0, 3) })}
              />
            </label>
          </div>

          <p className="dlv-sentence">{sentence(zone)}</p>

          <div className="dlv-actions">
            <button
              type="button"
              className={zone.active ? "btn btn-outline btn-sm is-on" : "btn btn-outline btn-sm"}
              aria-pressed={zone.active}
              onClick={() => updateZone(zone.uid, { active: !zone.active })}
            >
              {zone.active ? "Entregando" : "Desligada"}
            </button>
            <ConfirmButton
              label="Remover região"
              onConfirm={() => change(draft.zones.filter((other) => other.uid !== zone.uid))}
            />
          </div>
        </section>
      ))}

      <div className="dlv-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={addZone}
          disabled={draft.zones.length >= LIMITS.zones}
        >
          + Adicionar região
        </button>
      </div>

      {problems.length > 0 && (
        <div className="msg-error" role="alert">
          <p>Falta acertar:</p>
          <ul>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {notice && (
        <p className={notice.ok ? "msg-ok" : "msg-error"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}

      <div className="dlv-save">
        {dirty && <span className="chip chip-wait">Não salvo</span>}
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? "Salvando…" : "Salvar regiões"}
        </button>
      </div>
    </section>
  );
}
