import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DishOptions from "../novo/DishOptions";
import { OPT_LOAD_ERROR, OPT_SAVE_ERROR } from "../novo/copy";
import type { OptionsHeardView } from "../novo/types";
import { toCents } from "../customer/cart";
import { canListen, DICTATION_PATIENCE_MS, hear, type Hearing } from "../assistant/voiceIO";
import { fetchProductOptions, saveProductOptions } from "../service/api";
import { fromApi, toPayload, validate, type DraftGroup, type StarterKind } from "../service/optionsDraft";
import { ARM_MS, wordsOf } from "./dishesLogic";
import {
  addItem,
  addStarter,
  flipItem,
  hearOptions,
  isDirty,
  optionsViewOf,
  priceItem,
  removeGroup,
  removeItem,
  renameGroup,
  renameItem,
  savedTextOf,
  setRequired,
  snapshotOf,
  stepMax,
  stepMin,
} from "./optionsLogic";

type Props = {
  productId: string;
  productName: string;
  /** O preço do prato: um tamanho dito como "grande 50" é lido contra ele. */
  price: number | string;
  /** Voltar para a lista de pratos. */
  onBack: () => void;
  /** As opções foram salvas: a lista de pratos olha de novo (o resumo do lápis muda). */
  onSaved: () => void;
};

/**
 * As opções de um prato, de verdade: abre as que o servidor tem, deixa montar falando, escrevendo ou tocando, e só salva
 * quando a pessoa toca em "Salvar as opções", depois de conferir tudo do mesmo jeito que o servidor confere. Sair com coisa
 * por salvar pede um segundo toque. A frase do servidor, quando ele recusa, passa como veio.
 */
export default function DishOptionsScreen({ productId, productName, price, onBack, onSaved }: Props) {
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [said, setSaid] = useState<OptionsHeardView | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [armedGroup, setArmedGroup] = useState<string | null>(null);
  const [backArmed, setBackArmed] = useState(false);

  const alive = useRef(true);
  /** A abertura vale uma só: se a pessoa tocar em "Tentar de novo" duas vezes, a resposta velha não escreve por cima. */
  const opening = useRef(0);
  const groupsRef = useRef<DraftGroup[]>(groups);
  groupsRef.current = groups;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const working = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const hearing = useRef<Hearing | null>(null);
  const heardRef = useRef("");
  const session = useRef(0);
  const voiceWorks = useMemo(() => canListen(), []);
  const baseCents = toCents(price);

  const focusLater = useCallback((id: string) => {
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  }, []);

  const open = useCallback(async () => {
    const mine = ++opening.current;
    setLoad("loading");
    setError("");
    try {
      const data = await fetchProductOptions(productId);
      if (!alive.current || mine !== opening.current) return;
      const drafts = fromApi(data.groups);
      setGroups(drafts);
      setSaved(snapshotOf(drafts));
      setLoad("ready");
    } catch (failure) {
      if (!alive.current || mine !== opening.current) return;
      setError(wordsOf(failure, OPT_LOAD_ERROR));
      setLoad("error");
    }
  }, [productId]);

  useEffect(() => {
    alive.current = true;
    void open();
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
      session.current += 1;
      hearing.current?.cancel();
    };
  }, [open]);

  const view = useMemo(
    () =>
      optionsViewOf({
        load,
        productName,
        groups,
        saved,
        canListen: voiceWorks,
        listening,
        heard,
        said,
        saving,
        problems,
        notice,
        error,
        armedGroup,
        backArmed,
      }),
    [load, productName, groups, saved, voiceWorks, listening, heard, said, saving, problems, notice, error, armedGroup, backArmed],
  );

  /** Toda mudança feita à mão: some o aviso de antes e o que estava armado. Durante o envio a tela espera. */
  const change = (next: DraftGroup[]) => {
    if (working.current) return;
    window.clearTimeout(timer.current);
    setArmedGroup(null);
    setBackArmed(false);
    setProblems([]);
    setNotice(null);
    setGroups(next);
  };

  const understand = (words: string) => {
    if (working.current) return;
    const out = hearOptions(groupsRef.current, words, baseCents);
    window.clearTimeout(timer.current);
    setArmedGroup(null);
    setBackArmed(false);
    setProblems([]);
    setNotice(null);
    if (out.groups !== groupsRef.current) setGroups(out.groups);
    setSaid(out.heard);
    focusLater("nv-opt-live");
  };

  const stopListening = () => {
    session.current += 1;
    hearing.current?.cancel();
    hearing.current = null;
    heardRef.current = "";
    setListening(false);
    setHeard("");
  };

  const mic = async () => {
    if (hearing.current) {
      // Tocar para parar não joga fora o que já foi ouvido: vale como se a pessoa tivesse terminado a frase.
      const words = heardRef.current.trim();
      stopListening();
      understand(words);
      return;
    }
    if (!canListen() || working.current) return;
    const mine = ++session.current;
    setListening(true);
    setHeard("");
    setSaid(null);
    heardRef.current = "";
    const listener = hear({
      onPartial: (text) => {
        if (mine !== session.current) return;
        heardRef.current = text;
        setHeard(text);
      },
      patienceMs: DICTATION_PATIENCE_MS,
    });
    hearing.current = listener;
    const transcript = await listener.result;
    if (mine !== session.current || !alive.current) return;
    hearing.current = null;
    heardRef.current = "";
    setListening(false);
    setHeard("");
    understand((transcript ?? "").trim());
  };

  const starter = (kind: string) => {
    const next = addStarter(groupsRef.current, kind as StarterKind);
    if (next === groupsRef.current) return;
    change(next);
    const group = next[next.length - 1];
    const blank = group.items.find((item) => item.name.trim() === "");
    focusLater(blank ? `nv-opt-iname-${group.uid}-${blank.uid}` : `nv-opt-name-${group.uid}`);
  };

  const more = (groupUid: string) => {
    const next = addItem(groupsRef.current, groupUid);
    if (next === groupsRef.current) return;
    change(next);
    const group = next.find((entry) => entry.uid === groupUid);
    const added = group?.items[group.items.length - 1];
    if (group && added) focusLater(`nv-opt-iname-${group.uid}-${added.uid}`);
  };

  const lessGroup = (groupUid: string) => {
    if (working.current) return;
    if (armedGroup !== groupUid) {
      // Primeiro toque: guarda este grupo e espera o segundo por alguns segundos. Ninguém apaga um grupo com um toque só.
      window.clearTimeout(timer.current);
      setArmedGroup(groupUid);
      timer.current = window.setTimeout(() => setArmedGroup(null), ARM_MS);
      return;
    }
    change(removeGroup(groupsRef.current, groupUid));
    focusLater("nv-opt-live");
  };

  const back = () => {
    if (working.current) return;
    stopListening();
    if (load === "ready" && isDirty(groupsRef.current, savedRef.current) && !backArmed) {
      // Há coisa por salvar: o primeiro toque só avisa; o segundo sai sem salvar.
      window.clearTimeout(timer.current);
      setBackArmed(true);
      timer.current = window.setTimeout(() => setBackArmed(false), ARM_MS);
      return;
    }
    onBack();
  };

  const save = async () => {
    if (working.current || load !== "ready") return;
    const found = validate(groupsRef.current);
    if (found.length > 0) {
      setProblems(found);
      setNotice(null);
      focusLater("nv-opt-live");
      return;
    }
    working.current = true;
    stopListening();
    setSaving(true);
    setNotice(null);
    setProblems([]);
    try {
      const data = await saveProductOptions(productId, toPayload(groupsRef.current));
      if (!alive.current) return;
      const drafts = fromApi(data.groups);
      setGroups(drafts);
      setSaved(snapshotOf(drafts));
      setSaid(null);
      setNotice({ ok: true, text: savedTextOf(drafts.length) });
      onSaved();
    } catch (failure) {
      if (alive.current) setNotice({ ok: false, text: wordsOf(failure, OPT_SAVE_ERROR) });
    } finally {
      working.current = false;
      if (alive.current) {
        setSaving(false);
        focusLater("nv-opt-live");
      }
    }
  };

  return (
    <DishOptions
      view={view}
      onMic={() => void mic()}
      onText={understand}
      onCloseSaid={() => setSaid(null)}
      onStarter={starter}
      onGroupName={(group, value) => change(renameGroup(groupsRef.current, group, value))}
      onRequired={(group, required) => change(setRequired(groupsRef.current, group, required))}
      onMax={(group, delta) => change(stepMax(groupsRef.current, group, delta))}
      onMin={(group, delta) => change(stepMin(groupsRef.current, group, delta))}
      onItemName={(group, item, value) => change(renameItem(groupsRef.current, group, item, value))}
      onItemPrice={(group, item, value) => change(priceItem(groupsRef.current, group, item, value))}
      onItemFlip={(group, item) => change(flipItem(groupsRef.current, group, item))}
      onAddItem={more}
      onRemoveItem={(group, item) => change(removeItem(groupsRef.current, group, item))}
      onRemoveGroup={lessGroup}
      onSave={() => void save()}
      onBack={back}
      onRetry={() => void open()}
    />
  );
}
