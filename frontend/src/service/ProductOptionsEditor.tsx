import { useEffect, useMemo, useState } from "react";
import { fetchProductOptions, saveProductOptions } from "./api";
import ConfirmButton from "./ConfirmButton";
import {
  LIMITS,
  STARTERS,
  blankItem,
  fitGroup,
  fromApi,
  sentence,
  starter,
  toPayload,
  validate,
  type DraftGroup,
  type DraftItem,
  type StarterKind,
} from "./optionsDraft";

type Props = {
  productId: string;
  productName: string;
  /** The options were saved: the dish list refreshes its "N grupos de opções" label. */
  onSaved: () => void;
};

type Load = "loading" | "ready" | "error";

/** Count 0..n as option elements for a select. */
function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n += 1) out.push(n);
  return out;
}

/**
 * Where the owner builds the choices of one dish: size, extras, "no onion". Opens under the dish row.
 * Ready-made groups (Tamanho, Adicionais, Retirar) mean almost no typing; the sentence under each group says
 * what the customer will be asked.
 */
export default function ProductOptionsEditor({ productId, productName, onSaved }: Props) {
  const [load, setLoad] = useState<Load>("loading");
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const snapshot = (list: DraftGroup[]) => JSON.stringify(toPayload(list));

  async function open() {
    setLoad("loading");
    try {
      const data = await fetchProductOptions(productId);
      const drafts = fromApi(data.groups);
      setGroups(drafts);
      setSaved(snapshot(drafts));
      setLoad("ready");
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui abrir as opções." });
      setLoad("error");
    }
  }

  useEffect(() => {
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const dirty = useMemo(() => load === "ready" && snapshot(groups) !== saved, [groups, saved, load]);

  function change(next: DraftGroup[]) {
    setGroups(next);
    setProblems([]);
    setNotice(null);
  }

  const updateGroup = (uid: string, patch: Partial<DraftGroup>) =>
    change(groups.map((group) => (group.uid === uid ? fitGroup({ ...group, ...patch }) : group)));

  const updateItem = (groupUid: string, itemUid: string, patch: Partial<DraftItem>) =>
    change(
      groups.map((group) =>
        group.uid === groupUid
          ? { ...group, items: group.items.map((item) => (item.uid === itemUid ? { ...item, ...patch } : item)) }
          : group
      )
    );

  const addItem = (groupUid: string) =>
    change(
      groups.map((group) =>
        group.uid === groupUid && group.items.length < LIMITS.items
          ? { ...group, items: [...group.items, blankItem()] }
          : group
      )
    );

  const removeItem = (groupUid: string, itemUid: string) =>
    change(
      groups.map((group) =>
        group.uid === groupUid
          ? fitGroup({ ...group, items: group.items.filter((item) => item.uid !== itemUid) })
          : group
      )
    );

  const addGroup = (kind: StarterKind) => {
    if (groups.length >= LIMITS.groups) return;
    change([...groups, starter(kind)]);
  };

  async function save() {
    const found = validate(groups);
    if (found.length > 0) {
      setProblems(found);
      setNotice(null);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const data = await saveProductOptions(productId, toPayload(groups));
      const drafts = fromApi(data.groups);
      setGroups(drafts);
      setSaved(snapshot(drafts));
      setProblems([]);
      setNotice({
        ok: true,
        text: drafts.length === 0 ? "Pronto. Este prato ficou sem opções." : "Opções salvas. Os clientes já veem.",
      });
      onSaved();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui salvar. Tente de novo." });
    } finally {
      setSaving(false);
    }
  }

  if (load === "loading") {
    return (
      <p className="adm-muted" role="status">
        Abrindo as opções…
      </p>
    );
  }

  if (load === "error") {
    return (
      <div className="opt-ed">
        {notice && (
          <p className="msg-error" role="alert">
            {notice.text}
          </p>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void open()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="opt-ed" aria-label={`Opções de ${productName}`}>
      {groups.length === 0 ? (
        <p className="adm-muted">
          Este prato não tem opções. Toque em um modelo para começar. Os nomes são só sugestões, é só mudar.
        </p>
      ) : (
        <p className="adm-muted">
          O cliente escolhe antes de pedir. O preço de cada opção soma no prato. Se algo acabar, toque em Tem e vira Acabou.
        </p>
      )}

      {groups.map((group, index) => {
        const count = group.items.length;
        const top = Math.max(1, Math.min(count, LIMITS.pick));
        return (
          <section className="opt-ed-group" key={group.uid} aria-label={group.name || `Grupo ${index + 1}`}>
            <label className="field">
              <span>Nome do grupo</span>
              <input
                value={group.name}
                maxLength={LIMITS.name}
                placeholder="Ex.: Tamanho"
                onChange={(event) => updateGroup(group.uid, { name: event.target.value })}
              />
            </label>

            <div className="opt-ed-rules">
              <label className="field">
                <span>Mínimo</span>
                <select
                  value={group.min}
                  onChange={(event) => updateGroup(group.uid, { min: Number(event.target.value) })}
                >
                  {range(0, Math.min(count, LIMITS.pick)).map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "0 (opcional)" : n === 1 ? "1 (obrigatório)" : `${n} (obrigatório)`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Máximo</span>
                <select
                  value={group.max}
                  onChange={(event) => updateGroup(group.uid, { max: Number(event.target.value) })}
                >
                  {range(1, top).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="opt-ed-sentence">{sentence(group)}</p>

            <ul className="opt-ed-items">
              {group.items.map((item, position) => (
                <li className={item.active ? "opt-ed-item" : "opt-ed-item is-off"} key={item.uid}>
                  <label className="field opt-ed-name">
                    <span className="sr-only">{`Nome da opção ${position + 1}`}</span>
                    <input
                      value={item.name}
                      maxLength={LIMITS.name}
                      placeholder="Nome da opção"
                      onChange={(event) => updateItem(group.uid, item.uid, { name: event.target.value })}
                    />
                  </label>
                  <label className="field opt-ed-price">
                    <span className="sr-only">{`Preço extra de ${item.name || `opção ${position + 1}`}`}</span>
                    <input
                      value={item.price}
                      inputMode="decimal"
                      placeholder="+ 0,00"
                      onChange={(event) => updateItem(group.uid, item.uid, { price: event.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className={item.active ? "btn btn-outline btn-sm opt-ed-switch is-on" : "btn btn-outline btn-sm opt-ed-switch"}
                    aria-pressed={item.active}
                    onClick={() => updateItem(group.uid, item.uid, { active: !item.active })}
                  >
                    {item.active ? "Tem" : "Acabou"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm opt-ed-x"
                    aria-label={`Tirar ${item.name || `a opção ${position + 1}`}`}
                    onClick={() => removeItem(group.uid, item.uid)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="opt-ed-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => addItem(group.uid)}
                disabled={count >= LIMITS.items}
              >
                + Adicionar opção
              </button>
              <ConfirmButton
                label="Remover grupo"
                onConfirm={() => change(groups.filter((other) => other.uid !== group.uid))}
              />
            </div>
          </section>
        );
      })}

      {groups.length < LIMITS.groups && (
        <div className="opt-ed-starters">
          <span className="adm-muted">{groups.length === 0 ? "Começar com:" : "Adicionar grupo:"}</span>
          {STARTERS.map((option) => (
            <button
              key={option.kind}
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => addGroup(option.kind)}
            >
              + {option.label}
            </button>
          ))}
        </div>
      )}

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

      <div className="opt-ed-save">
        {dirty && <span className="chip chip-wait">Não salvo</span>}
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? "Salvando…" : "Salvar opções"}
        </button>
      </div>
    </div>
  );
}
