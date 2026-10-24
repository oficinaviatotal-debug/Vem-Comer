import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Vendas from "../novo/Vendas";
import { browserStore, createPhraser, type Phraser } from "../novo/phrasing";
import {
  SALES_LIVE_COPIED,
  SALES_LIVE_FORGOT,
  SALES_LIVE_NO,
  SALES_LIVE_OTHER,
  SALES_LIVE_REPLY,
  SALES_LIVE_SENT,
  SALES_LIVE_STAGE,
  SALES_LOAD_ERROR,
  SALES_MANUAL,
  SALES_REFRESH_FAIL,
  SALES_REFRESH_LIST,
} from "../novo/vendasCopy";
import type { SalesFormValues } from "../novo/types";
import { salesUrl } from "../service/links";
import { copyText } from "../service/clipboard";
import {
  addProspect,
  fetchSales,
  forgetProspect,
  markReply,
  markSent,
  moveStage,
  readContact,
  type ReplyResult,
  type SalesOverview,
  type SalesProspect,
} from "../service/salesApi";
import {
  anotherDraft,
  applyRead,
  channelOf,
  cleanSender,
  copyTextOf,
  draftKey,
  draftOf,
  emptyForm,
  firstName,
  formProblem,
  formViewOf,
  hasDraft,
  salesViewOf,
  savedText,
  stageSaid,
  toNewProspect,
  type CardUi,
  type Draft,
} from "./vendasLogic";

type Props = {
  /** O nome de quem está no painel: o rascunho começa assinado com o primeiro nome dele. */
  senderName: string;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

type Load = "loading" | "ready" | "error";

type FormState = { values: SalesFormValues; reading: boolean; readNote: string; saving: boolean; error: string };

/** A frase do servidor quando há (ele escreve em português); senão a nossa. */
const wordsOf = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? error.message : fallback);

const SENDER_KEY = "vem_vendas_nome";
const COPIED_MS = 3000;

function savedSender(fallback: string): string {
  try {
    const kept = window.localStorage.getItem(SENDER_KEY);
    if (kept !== null) return kept;
  } catch {
    // Sem armazenamento (aba privada): vale o primeiro nome de quem entrou.
  }
  return fallback;
}

function keepSender(text: string) {
  try {
    window.localStorage.setItem(SENDER_KEY, text);
  } catch {
    // Não guardou: o nome vale até fechar a página.
  }
}

/**
 * Vendas, o caderno do dono do sistema. Busca quem procurar hoje e quem espera resposta, monta o rascunho de cada negócio
 * e anota o que a pessoa do Vem fez. **Nada é enviado daqui**: o WhatsApp e o e-mail abrem com o texto pronto, quem confere
 * e envia é a pessoa, e só depois ela toca em "Já mandei".
 */
export default function VendasScreen({ senderName, onMenu }: Props) {
  const link = useMemo(() => salesUrl(window.location.origin, window.location.pathname), []);
  const talker = useRef<Phraser | null>(null);
  const speaker = (): Phraser => {
    if (!talker.current) talker.current = createPhraser({ store: browserStore() });
    return talker.current;
  };

  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [error, setError] = useState("");
  const [sender, setSender] = useState(() => savedSender(firstName(senderName)));
  const [ui, setUi] = useState<Record<string, CardUi>>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState("");
  const [live, setLive] = useState("");
  const [, setDraftVersion] = useState(0);

  const alive = useRef(true);
  const drafts = useRef(new Map<string, Draft>());
  const copiedTimer = useRef<number | undefined>(undefined);

  const patch = useCallback((id: string, change: Partial<CardUi>) => {
    setUi((now) => ({ ...now, [id]: { ...now[id], ...change } }));
  }, []);

  /** Busca de novo sem piscar a tela. Tira do guardado o que não está mais na lista. */
  const refresh = useCallback(async () => {
    const data = await fetchSales();
    if (!alive.current) return;
    setOverview(data);
    const ids = new Set([...data.today.items, ...data.waiting.items].map((item) => item.id));
    setUi((now) => Object.fromEntries(Object.entries(now).filter(([id]) => ids.has(id))));
    const live = new Set(data.today.items.map((item) => item.id));
    for (const key of [...drafts.current.keys()]) if (!live.has(key.split("|")[0])) drafts.current.delete(key);
  }, []);

  const open = useCallback(async () => {
    setLoad("loading");
    setError("");
    try {
      await refresh();
      if (!alive.current) return;
      setLoad("ready");
    } catch (failure) {
      if (!alive.current) return;
      setError(wordsOf(failure, SALES_LOAD_ERROR));
      setLoad("error");
    }
  }, [refresh]);

  useEffect(() => {
    alive.current = true;
    void open();
    return () => {
      alive.current = false;
      window.clearTimeout(copiedTimer.current);
    };
  }, [open]);

  const signer = cleanSender(sender);

  /** O rascunho do canal da vez. Fica guardado: o texto não muda a cada vez que a tela se desenha. */
  const draftFor = useCallback(
    (prospect: SalesProspect, chosen?: string | null): Draft | null => {
      if (!hasDraft(prospect)) return null;
      const channel = channelOf(prospect, chosen);
      const key = draftKey(prospect, channel, signer, link);
      let found = drafts.current.get(key);
      if (!found) {
        found = draftOf({ prospect, sender: signer, salesLink: link, channel, phraser: speaker() });
        drafts.current.set(key, found);
      }
      return found;
    },
    [signer, link],
  );

  const draftMap: Record<string, Draft | null> = {};
  for (const prospect of overview?.today.items ?? []) draftMap[prospect.id] = draftFor(prospect, ui[prospect.id]?.channel);

  const view = salesViewOf({
    load,
    error,
    overview,
    sender,
    ui,
    drafts: draftMap,
    form: form ? formViewOf(form.values, form) : null,
    saved,
    live,
    now: new Date(),
  });

  const find = useCallback(
    (id: string): SalesProspect | undefined => [...(overview?.today.items ?? []), ...(overview?.waiting.items ?? [])].find((item) => item.id === id),
    [overview],
  );

  /** Roda uma ação do cartão: trava os botões, anota no servidor, busca a lista de novo e conta o que aconteceu. */
  const act = useCallback(
    async (id: string, work: () => Promise<void>, done: (name: string) => string) => {
      const prospect = find(id);
      if (!prospect) return;
      patch(id, { busy: true, error: "" });
      try {
        await work();
      } catch (failure) {
        if (!alive.current) return;
        patch(id, { busy: false, error: wordsOf(failure, "Não consegui anotar. Tente de novo.") });
        return;
      }
      // Já está anotado no servidor. Se a lista não voltar, o negócio sai da tela do mesmo jeito: nada de tocar de novo e anotar dois contatos.
      try {
        await refresh();
        if (!alive.current) return;
        setSaved("");
        setLive(done(prospect.business_name));
      } catch {
        if (!alive.current) return;
        setOverview((now) => (now ? { ...now, today: { ...now.today, items: now.today.items.filter((item) => item.id !== id) } } : now));
        setSaved(SALES_REFRESH_FAIL);
        setLive(SALES_REFRESH_FAIL);
      }
    },
    [find, patch, refresh],
  );

  const copy = useCallback(
    async (id: string) => {
      const prospect = find(id);
      const draft = prospect ? draftFor(prospect, ui[id]?.channel) : null;
      if (!draft) return;
      const text = copyTextOf(draft);
      // O campo escondido é só para o jeito antigo de copiar (selecionar e copiar), quando o celular recusa o novo.
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      document.body.appendChild(field);
      const ok = await copyText(text, field);
      field.remove();
      if (!alive.current) return;
      window.clearTimeout(copiedTimer.current);
      if (ok) {
        patch(id, { copied: true, manual: null });
        setLive(SALES_LIVE_COPIED);
        copiedTimer.current = window.setTimeout(() => patch(id, { copied: false }), COPIED_MS);
      } else {
        patch(id, { copied: false, manual: text });
        setLive(SALES_MANUAL);
      }
    },
    [draftFor, find, patch, ui],
  );

  const another = useCallback(
    (id: string) => {
      const prospect = find(id);
      if (!prospect) return;
      const channel = channelOf(prospect, ui[id]?.channel);
      const current = draftFor(prospect, channel);
      if (!current) return;
      const key = draftKey(prospect, channel, signer, link);
      drafts.current.set(key, anotherDraft({ prospect, sender: signer, salesLink: link, channel, phraser: speaker() }, current));
      patch(id, { copied: false, manual: null });
      setDraftVersion((now) => now + 1);
      setLive(SALES_LIVE_OTHER);
    },
    [draftFor, find, link, patch, signer, ui],
  );

  const field = useCallback((name: keyof SalesFormValues, value: string) => {
    setForm((now) => (now ? { ...now, values: { ...now.values, [name]: value }, error: "" } : now));
  }, []);

  const read = useCallback(async () => {
    if (!form || !form.values.paste.trim()) return;
    setForm((now) => (now ? { ...now, reading: true, readNote: "", error: "" } : now));
    try {
      const found = await readContact(form.values.paste);
      if (!alive.current) return;
      setForm((now) => {
        if (!now) return now;
        const next = applyRead(now.values, found);
        return { ...now, values: next.values, readNote: next.note, reading: false };
      });
    } catch (failure) {
      if (!alive.current) return;
      setForm((now) => (now ? { ...now, reading: false, error: wordsOf(failure, "Não consegui ler esse texto.") } : now));
    }
  }, [form]);

  const save = useCallback(async () => {
    if (!form || form.saving) return;
    const problem = formProblem(form.values);
    if (problem) {
      setForm({ ...form, error: problem });
      return;
    }
    setForm({ ...form, saving: true, error: "" });
    let answer: { created: boolean; reason: string | null };
    try {
      answer = await addProspect(toNewProspect(form.values));
    } catch (failure) {
      if (!alive.current) return;
      setForm((now) => (now ? { ...now, saving: false, error: wordsOf(failure, "Não consegui guardar o negócio.") } : now));
      return;
    }
    // Já está guardado no servidor: o formulário fecha mesmo que a lista não volte (senão a pessoa guardaria o mesmo negócio duas vezes).
    const text = savedText(answer, form.values.name);
    let listed = true;
    try {
      await refresh();
    } catch {
      listed = false;
    }
    if (!alive.current) return;
    setSaved(listed ? text : `${text} ${SALES_REFRESH_LIST}`);
    setLive(listed ? text : `${text} ${SALES_REFRESH_LIST}`);
    setForm(null);
  }, [form, refresh]);

  return (
    <Vendas
      view={view}
      onMenu={onMenu}
      showMenu={Boolean(onMenu)}
      onRetry={() => void open()}
      onSender={(text) => {
        const next = text.slice(0, 30);
        setSender(next);
        keepSender(next);
      }}
      onAdd={() => {
        setSaved("");
        setForm({ values: emptyForm(), reading: false, readNote: "", saving: false, error: "" });
      }}
      onChannel={(id, channel) => patch(id, { channel, copied: false, manual: null })}
      onCopy={(id) => void copy(id)}
      onAnother={another}
      onSent={(id) => {
        const prospect = find(id);
        if (!prospect) return;
        const channel = channelOf(prospect, ui[id]?.channel);
        void act(id, () => markSent(id, channel), SALES_LIVE_SENT);
      }}
      onAskReply={(id) => patch(id, { replyOpen: !ui[id]?.replyOpen, moreOpen: false, confirm: null })}
      onReply={(id, result) => void act(id, async () => void (await markReply(id, result as ReplyResult)), SALES_LIVE_REPLY)}
      onStage={(id, stage) => {
        void act(id, () => moveStage(id, stage), (name) => SALES_LIVE_STAGE(name, stageSaid(stage)));
      }}
      onMore={(id) => patch(id, { moreOpen: !ui[id]?.moreOpen, replyOpen: false, confirm: null })}
      onAskConfirm={(id, kind) => patch(id, { confirm: kind })}
      onCancelConfirm={(id) => patch(id, { confirm: null })}
      onConfirmNo={(id) => void act(id, async () => void (await markReply(id, "nao_quer")), SALES_LIVE_NO)}
      onConfirmForget={(id) => void act(id, () => forgetProspect(id), SALES_LIVE_FORGOT)}
      onField={field}
      onRead={() => void read()}
      onSave={() => void save()}
      onCancelForm={() => setForm(null)}
    />
  );
}
