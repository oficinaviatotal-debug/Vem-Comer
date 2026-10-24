import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Share from "../novo/Share";
import {
  SHARE_CARD_ERROR,
  SHARE_CARD_READY_LIVE,
  SHARE_COPIED_CAPTION_LIVE,
  SHARE_COPIED_LINK_LIVE,
  SHARE_COPIED_MESSAGE_LIVE,
  SHARE_DOWNLOADED_LIVE,
  SHARE_LOAD_ERROR,
  SHARE_MANUAL,
  SHARE_OTHER_CAPTION_LIVE,
  SHARE_OTHER_MESSAGE_LIVE,
  SHARE_SENT_LIVE,
  SHARE_SEND_ERROR,
} from "../novo/copy";
import { browserStore, createPhraser, plainPhraser, type Phraser } from "../novo/phrasing";
import type { ShareManual } from "../novo/types";
import { mediaUrl } from "../service/api";
import { copyText } from "../service/clipboard";
import type { Product } from "../customer/types";
import { loadDishes } from "./dishesApi";
import { canShareFiles, downloadCard, renderCard, sendCard } from "./shareCardRender";
import {
  anotherCaption,
  anotherMessage,
  captionOf,
  cardFileName,
  cardSpec,
  dishChoices,
  messageOf,
  shareLink,
  shareViewOf,
  type CardFormat,
} from "./shareLogic";

type Props = {
  companyId: string;
  /** O nome do restaurante na barra de endereço (a parte depois de ?empresa=). */
  slug: string;
  /** O nome do restaurante, para a mensagem e o cartão. Pode vir vazio. */
  name: string;
  /** "Maria, dono": quem está no painel, para o alto da tela. */
  person: string;
  /** Leva a outra tela do painel (o atalho para as Mesas). */
  onGo: (view: string) => void;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

type Load = "loading" | "ready" | "error";

/** A frase do servidor quando há (ele escreve em português); senão a nossa. */
const wordsOf = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? error.message : fallback);

const COPIED_MS = 3000;

/**
 * Divulgar (o "Meu link"). O dono copia o link, copia ou manda no WhatsApp a mensagem pronta e escolhe um prato para virar
 * cartão (imagem para postar). Tudo é dele: o WhatsApp abre com o texto pronto e é ele quem escolhe quem recebe, o menu de
 * compartilhar do celular é ele quem usa. Nada é enviado sozinho e nenhum dado de cliente entra aqui.
 */
export default function ShareScreen({ companyId, slug, name, person, onGo, onMenu }: Props) {
  const url = useMemo(() => shareLink(window.location.origin, window.location.pathname, slug), [slug]);
  const talker = useRef<Phraser | null>(null);
  const speaker = (): Phraser => {
    if (!talker.current) talker.current = createPhraser({ store: browserStore() });
    return talker.current;
  };

  const [message, setMessage] = useState(() => messageOf(plainPhraser, name, url));
  const [load, setLoad] = useState<Load>("loading");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [format, setFormat] = useState<CardFormat>("feed");
  const [brand, setBrand] = useState(true);
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState("");
  const [copied, setCopied] = useState<ShareManual["id"] | null>(null);
  const [manual, setManual] = useState<ShareManual | null>(null);
  const [live, setLive] = useState("");

  const alive = useRef(true);
  const made = useRef<Blob | null>(null);
  const shown = useRef<string | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  const canSendFile = useMemo(() => canShareFiles(), []);

  const open = useCallback(async () => {
    setLoad("loading");
    setError("");
    try {
      const data = await loadDishes(companyId);
      if (!alive.current) return;
      setProducts(data.products);
      setLoad("ready");
    } catch (failure) {
      if (!alive.current) return;
      setError(wordsOf(failure, SHARE_LOAD_ERROR));
      setLoad("error");
    }
  }, [companyId]);

  useEffect(() => {
    alive.current = true;
    void open();
    return () => {
      alive.current = false;
      window.clearTimeout(copiedTimer.current);
      if (shown.current) URL.revokeObjectURL(shown.current);
      shown.current = null;
    };
  }, [open]);

  const dishes = useMemo(() => dishChoices(products, mediaUrl), [products]);
  const dish = useMemo(() => dishes.find((candidate) => candidate.id === selectedId) ?? null, [dishes, selectedId]);

  /** Monta o cartão de novo quando muda o prato, o tamanho ou a marca. */
  useEffect(() => {
    if (shown.current) {
      URL.revokeObjectURL(shown.current);
      shown.current = null;
    }
    made.current = null;
    setImage(null);
    if (!dish) {
      setBusy(false);
      setCardError("");
      return;
    }
    let cancelled = false;
    setBusy(true);
    setCardError("");
    renderCard(cardSpec({ format, restaurant: name, dish, url, brand }))
      .then((blob) => {
        if (cancelled || !alive.current) return;
        made.current = blob;
        shown.current = URL.createObjectURL(blob);
        setImage(shown.current);
        setBusy(false);
        setLive(SHARE_CARD_READY_LIVE(dish.name));
      })
      .catch(() => {
        if (cancelled || !alive.current) return;
        setBusy(false);
        setCardError(SHARE_CARD_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [dish, format, brand, name, url]);

  const clearCopy = useCallback(() => {
    window.clearTimeout(copiedTimer.current);
    setCopied(null);
    setManual(null);
  }, []);

  /** Copia; se o celular não deixa, o texto aparece marcado para a pessoa segurar e copiar. */
  const copy = useCallback(async (id: ShareManual["id"], text: string, done: string) => {
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
      setManual(null);
      setCopied(id);
      setLive(done);
      copiedTimer.current = window.setTimeout(() => setCopied(null), COPIED_MS);
    } else {
      setCopied(null);
      setManual({ id, text });
      setLive(SHARE_MANUAL);
    }
  }, []);

  const pick = useCallback(
    (id: string) => {
      const next = dishes.find((candidate) => candidate.id === id);
      if (!next) return;
      clearCopy();
      setSelectedId(id);
      setCaption(captionOf(plainPhraser, next.name, next.price, url));
    },
    [dishes, url, clearCopy],
  );

  const sendFile = useCallback(async () => {
    if (!made.current || !dish) return;
    const result = await sendCard(made.current, cardFileName(dish.name, format), caption);
    if (!alive.current) return;
    if (result === "sent") {
      setCardError("");
      setLive(SHARE_SENT_LIVE);
    } else if (result === "failed") {
      setCardError(SHARE_SEND_ERROR);
    }
  }, [dish, format, caption]);

  const download = useCallback(() => {
    if (!made.current || !dish) return;
    downloadCard(made.current, cardFileName(dish.name, format));
    setLive(SHARE_DOWNLOADED_LIVE);
  }, [dish, format]);

  const view = shareViewOf({
    person,
    name,
    link: url,
    message,
    load,
    error,
    dishes,
    totalProducts: products.length,
    showAll,
    selectedId: dish ? dish.id : null,
    format,
    brand,
    caption,
    image,
    busy,
    cardError,
    canSendFile,
    copied,
    manual,
    live,
  });

  return (
    <Share
      view={view}
      onMenu={onMenu}
      showMenu={Boolean(onMenu)}
      onCopyLink={() => void copy("link", url, SHARE_COPIED_LINK_LIVE)}
      onCopyMessage={() => void copy("message", message, SHARE_COPIED_MESSAGE_LIVE)}
      onOtherMessage={() => {
        clearCopy();
        setMessage((now) => anotherMessage(speaker(), name, url, now));
        setLive(SHARE_OTHER_MESSAGE_LIVE);
      }}
      onPickDish={pick}
      onMoreDishes={() => setShowAll(true)}
      onRetry={() => void open()}
      onFormat={(id) => setFormat(id)}
      onBrand={setBrand}
      onSendFile={() => void sendFile()}
      onDownload={download}
      onCopyCaption={() => void copy("caption", caption, SHARE_COPIED_CAPTION_LIVE)}
      onOtherCaption={() => {
        if (!dish) return;
        clearCopy();
        setCaption((now) => anotherCaption(speaker(), dish.name, dish.price, url, now));
        setLive(SHARE_OTHER_CAPTION_LIVE);
      }}
      onGoTables={() => onGo("mesas")}
    />
  );
}
