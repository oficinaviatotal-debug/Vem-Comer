import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "../novo/Logo";
import {
  LOGO_LOAD_ERROR,
  LOGO_MAKE_FAIL,
  LOGO_NOTHING_SAVED,
  LOGO_REMOVED,
  LOGO_REMOVE_FAIL,
  LOGO_SAVED,
  LOGO_SEND_FAIL,
} from "../novo/copy";
import { canListen, DICTATION_PATIENCE_MS, hear, type Hearing } from "../assistant/voiceIO";
import { deleteCompanyLogo, fetchCompany, mediaUrl, uploadCompanyLogo } from "../service/api";
import { renderLogoPng, prepareLogoFile, reviewLogoFile, type LogoReviewResult } from "../logo/logoFiles";
import type { FoodId, PaletteId, TemplateId } from "../logo/logoLogic";
import { ARM_MS, wordsOf } from "./dishesLogic";
import { makerPictures } from "./LogoPictures";
import {
  foodFromWords,
  localFailText,
  logoViewOf,
  makerSpec,
  markCut,
  nameFromWords,
  nameProblem,
  nextStep,
  pickFood,
  pickModel,
  pickPalette,
  prevStep,
  saidFoodText,
  saidNameText,
  startMaker,
  typeName,
  uploadNameOf,
  type MakerState,
} from "./logoViewLogic";

type Props = {
  companyId: string;
  /** Voltar para o menu do painel. */
  onBack: () => void;
  /** A logomarca mudou (salva ou removida): o painel pode mostrar a nova no topo. `null` = sem logomarca. */
  onChanged?: (logoPath: string | null) => void;
};

type Brand = { name: string; logoPath: string | null };
type Candidate = LogoReviewResult & { useRefined: boolean };

/** Faz uma URL para mostrar o arquivo e a solta quando a tela fecha ou o arquivo muda. */
function useObjectUrl(blob: Blob | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);
  return url;
}

/**
 * A logomarca de verdade: abre a que o servidor tem, deixa trocar tirando uma foto, escolhendo uma imagem do celular ou
 * criando uma em três toques (falando, escrevendo ou tocando), e só salva depois do "sim" da pessoa. Remover pede um segundo
 * toque. A frase do servidor, quando ele recusa, passa como veio; erro ao abrir nunca vira "sem logomarca".
 */
export default function LogoScreen({ companyId, onBack, onChanged }: Props) {
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [brand, setBrand] = useState<Brand>({ name: "", logoPath: null });
  const [mode, setMode] = useState<"home" | "review" | "maker">("home");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [maker, setMaker] = useState<MakerState | null>(null);
  const [working, setWorking] = useState<"" | "opening" | "saving" | "removing">("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [removeArmed, setRemoveArmed] = useState(false);
  const [listening, setListening] = useState<"" | "food" | "name">("");
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");

  const alive = useRef(true);
  /** A abertura vale uma só: se a pessoa tocar em "Tentar de novo" duas vezes, a resposta velha não escreve por cima. */
  const opening = useRef(0);
  const working_ = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const hearing = useRef<Hearing | null>(null);
  const heardRef = useRef("");
  const listeningRef = useRef<"" | "food" | "name">("");
  const session = useRef(0);
  const makerRef = useRef<MakerState | null>(maker);
  makerRef.current = maker;
  const candidateRef = useRef<Candidate | null>(candidate);
  candidateRef.current = candidate;
  const brandRef = useRef(brand);
  brandRef.current = brand;
  const voiceWorks = useMemo(() => canListen(), []);

  const originalSrc = useObjectUrl(candidate?.original ?? null);
  const refinedSrc = useObjectUrl(candidate?.refined ?? null);

  const focusLater = useCallback((id: string) => {
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  }, []);

  const open = useCallback(async () => {
    const mine = ++opening.current;
    setLoad("loading");
    setLoadError("");
    try {
      const company = await fetchCompany(companyId);
      if (!alive.current || mine !== opening.current) return;
      const path = typeof company?.logo_url === "string" ? company.logo_url : null;
      setBrand({ name: String(company?.name ?? ""), logoPath: path });
      setLoad("ready");
    } catch (failure) {
      if (!alive.current || mine !== opening.current) return;
      setLoadError(wordsOf(failure, LOGO_LOAD_ERROR));
      setLoad("error");
    }
  }, [companyId]);

  const stopListening = useCallback(() => {
    session.current += 1;
    hearing.current?.cancel();
    hearing.current = null;
    heardRef.current = "";
    listeningRef.current = "";
    setListening("");
    setHeard("");
  }, []);

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
      logoViewOf({
        load,
        loadError,
        name: brand.name,
        logoSrc: mediaUrl(brand.logoPath),
        mode,
        working,
        notice,
        removeArmed,
        review: candidate
          ? { originalSrc, refinedSrc, useRefined: candidate.useRefined, tooLight: candidate.tooLight, small: candidate.small }
          : null,
        maker,
        canListen: voiceWorks,
        listening,
        heard,
        said,
      }),
    [load, loadError, brand, mode, working, notice, removeArmed, candidate, originalSrc, refinedSrc, maker, voiceWorks, listening, heard, said],
  );

  /** Vai para outra parte da tela: some o aviso de antes, o que estava armado e o que o celular estava ouvindo. */
  const go = (next: "home" | "review" | "maker", message: { ok: boolean; text: string } | null = null) => {
    window.clearTimeout(timer.current);
    stopListening();
    setRemoveArmed(false);
    setSaid("");
    setNotice(message);
    setMode(next);
    focusLater("nv-logo-live");
  };

  /** A logomarca foi salva: volta ao início já mostrando a nova. Só chamado depois de o servidor dizer que sim. */
  const saved = (path: string | null) => {
    setBrand((old) => ({ ...old, logoPath: path }));
    setCandidate(null);
    setMaker(null);
    go("home", { ok: true, text: LOGO_SAVED });
    onChanged?.(path);
    if (mediaUrl(path) === "") {
      // O servidor guardou, mas não mandou um endereço que dê para mostrar: olha de novo no servidor, sem trocar a tela.
      void fetchCompany(companyId)
        .then((company) => {
          if (alive.current) setBrand((old) => ({ ...old, logoPath: typeof company?.logo_url === "string" ? company.logo_url : null }));
        })
        .catch(() => undefined);
    }
  };

  /** A imagem do dono (foto na hora ou do celular): prepara, olha e mostra o "Ficou bom?". Nada é salvo ainda. */
  const chooseFile = async (file: File) => {
    if (working_.current || load !== "ready") return;
    working_.current = true;
    stopListening();
    setNotice(null);
    setWorking("opening");
    try {
      const prepared = await prepareLogoFile(file);
      const review = await reviewLogoFile(prepared);
      if (!alive.current) return;
      setCandidate({ ...review, useRefined: Boolean(review.refined) });
      setMode("review");
      setRemoveArmed(false);
      focusLater("nv-logo-live");
    } catch (failure) {
      if (alive.current) {
        setNotice({ ok: false, text: localFailText(failure) });
        focusLater("nv-logo-live");
      }
    } finally {
      working_.current = false;
      if (alive.current) setWorking("");
    }
  };

  const upload = async (blob: Blob) => {
    working_.current = true;
    setNotice(null);
    setWorking("saving");
    try {
      const result = await uploadCompanyLogo(blob, uploadNameOf(blob.type));
      if (!alive.current) return;
      saved(result.logo_url ?? null);
    } catch (failure) {
      // Fica onde está ("Ficou bom?" ou o criar): a pessoa tenta de novo sem escolher tudo outra vez.
      if (alive.current) {
        setNotice({ ok: false, text: wordsOf(failure, LOGO_SEND_FAIL) });
        focusLater("nv-logo-live");
      }
    } finally {
      working_.current = false;
      if (alive.current) setWorking("");
    }
  };

  const useCandidate = async () => {
    const current = candidateRef.current;
    if (!current || working_.current) return;
    await upload(current.useRefined && current.refined ? current.refined : current.original);
  };

  const makeAndSave = async () => {
    const current = makerRef.current;
    if (!current || working_.current) return;
    const problem = nameProblem(current);
    if (problem) {
      setNotice({ ok: false, text: problem });
      focusLater("nv-logo-name");
      return;
    }
    working_.current = true;
    stopListening();
    setNotice(null);
    setWorking("saving");
    let png: Blob;
    try {
      png = await renderLogoPng(makerSpec(current));
    } catch (failure) {
      working_.current = false;
      if (alive.current) {
        setWorking("");
        setNotice({ ok: false, text: localFailText(failure, LOGO_MAKE_FAIL) });
        focusLater("nv-logo-live");
      }
      return;
    }
    if (!alive.current) return;
    await upload(png);
  };

  const remove = async () => {
    if (working_.current || !brandRef.current.logoPath) return;
    if (!removeArmed) {
      // Primeiro toque: guarda e espera o segundo por alguns segundos. Ninguém tira a logomarca com um toque só.
      window.clearTimeout(timer.current);
      setNotice(null);
      setRemoveArmed(true);
      timer.current = window.setTimeout(() => setRemoveArmed(false), ARM_MS);
      return;
    }
    window.clearTimeout(timer.current);
    setRemoveArmed(false);
    working_.current = true;
    setNotice(null);
    setWorking("removing");
    try {
      await deleteCompanyLogo();
      if (!alive.current) return;
      setBrand((old) => ({ ...old, logoPath: null }));
      setNotice({ ok: true, text: LOGO_REMOVED });
      onChanged?.(null);
    } catch (failure) {
      if (alive.current) setNotice({ ok: false, text: wordsOf(failure, LOGO_REMOVE_FAIL) });
    } finally {
      working_.current = false;
      if (alive.current) {
        setWorking("");
        focusLater("nv-logo-live");
      }
    }
  };

  const cancel = () => {
    if (working_.current) return;
    setCandidate(null);
    setMaker(null);
    go("home", { ok: true, text: LOGO_NOTHING_SAVED });
  };

  const back = () => {
    if (working_.current) return;
    stopListening();
    onBack();
  };

  // ---------------------------------------------------------------------------------------------- criar em três toques

  const startMaking = () => {
    if (working_.current) return;
    setCandidate(null);
    setMaker(startMaker(brandRef.current.name));
    go("maker");
  };

  /** Toda mudança no criar: some o que foi dito e o aviso de antes. Durante o envio a tela espera. */
  const change = (next: MakerState | null) => {
    if (!next || working_.current) return;
    setSaid("");
    setNotice(null);
    setMaker(next);
  };

  const step = (to: (state: MakerState) => MakerState) => {
    const current = makerRef.current;
    if (!current || working_.current) return;
    const next = to(current);
    if (next === current) return;
    stopListening();
    setSaid("");
    setNotice(null);
    setMaker(next);
    focusLater("nv-logo-live");
  };

  const understand = (target: "food" | "name", words: string) => {
    const current = makerRef.current;
    if (!current || working_.current) return;
    if (target === "food") {
      const food = foodFromWords(words);
      if (food) setMaker(pickFood(current, food));
      setSaid(saidFoodText(words, food));
    } else {
      const name = nameFromWords(words);
      if (name) setMaker(typeName(current, name));
      setSaid(saidNameText(words, name));
    }
    setNotice(null);
    focusLater("nv-logo-live");
  };

  const mic = async (target: "food" | "name") => {
    if (hearing.current) {
      // Tocar para parar não joga fora o que já foi ouvido: vale como se a pessoa tivesse terminado a frase.
      const words = heardRef.current.trim();
      const what = listeningRef.current || target;
      stopListening();
      understand(what, words);
      return;
    }
    if (!canListen() || working_.current) return;
    const mine = ++session.current;
    listeningRef.current = target;
    setListening(target);
    setHeard("");
    setSaid("");
    heardRef.current = "";
    const listener = hear({
      onPartial: (text) => {
        if (mine !== session.current) return;
        heardRef.current = text;
        setHeard(text);
      },
      // O nome pode ter pausas ("Pizzaria do... Zé"): espera mais. O tipo de comida é uma palavra só.
      ...(target === "name" ? { patienceMs: DICTATION_PATIENCE_MS } : {}),
    });
    hearing.current = listener;
    const transcript = await listener.result;
    if (mine !== session.current || !alive.current) return;
    hearing.current = null;
    heardRef.current = "";
    listeningRef.current = "";
    setListening("");
    setHeard("");
    understand(target, (transcript ?? "").trim());
  };

  const pictures = makerPictures(maker, (template, cut) => setMaker((old) => (old ? markCut(old, template, cut) : old)));

  return (
    <Logo
      view={view}
      pictures={pictures}
      onFile={(file) => void chooseFile(file)}
      onMake={startMaking}
      onRemove={() => void remove()}
      onBack={back}
      onRetry={() => void open()}
      onUse={() => void useCandidate()}
      onToggleRefined={() => setCandidate((old) => (old ? { ...old, useRefined: !old.useRefined } : old))}
      onCancel={cancel}
      onFood={(id) => change(makerRef.current ? pickFood(makerRef.current, id as FoodId) : null)}
      onPalette={(id) => change(makerRef.current ? pickPalette(makerRef.current, id as PaletteId) : null)}
      onModel={(id) => change(makerRef.current ? pickModel(makerRef.current, id as TemplateId) : null)}
      onName={(value) => change(makerRef.current ? typeName(makerRef.current, value) : null)}
      onMic={(target) => void mic(target)}
      onNext={() => step(nextStep)}
      onPrev={() => step(prevStep)}
      onSave={() => void makeAndSave()}
    />
  );
}
