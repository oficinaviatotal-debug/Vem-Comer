import { useEffect, useRef } from "react";
import "./novo.css";
import NvIcon from "./Icons";
import { Photo, TopBar, VoiceOrb } from "./parts";
import {
  SHARE_BRAND,
  SHARE_BUSY,
  SHARE_CAPTION_TITLE,
  SHARE_CAPTION_WHATSAPP,
  SHARE_COPIED_CAPTION,
  SHARE_COPIED_LINK,
  SHARE_COPIED_MESSAGE,
  SHARE_COPY_CAPTION,
  SHARE_COPY_LINK,
  SHARE_COPY_MESSAGE,
  SHARE_DISHES_HINT,
  SHARE_DISHES_LOADING,
  SHARE_DISHES_MORE,
  SHARE_DISHES_RETRY,
  SHARE_DISHES_TITLE,
  SHARE_DOWNLOAD,
  SHARE_FORMAT_TITLE,
  SHARE_GO_TABLES,
  SHARE_INTRO,
  SHARE_LINK_TITLE,
  SHARE_MANUAL,
  SHARE_MESSAGE_HINT,
  SHARE_MESSAGE_TITLE,
  SHARE_OPEN,
  SHARE_OTHER_CAPTION,
  SHARE_OTHER_MESSAGE,
  SHARE_SEND_FILE,
  SHARE_TITLE,
  SHARE_WHATSAPP,
  SHARE_WHERE_INSTAGRAM,
  SHARE_WHERE_TABLES,
  SHARE_WHERE_TITLE,
  SHARE_WHERE_WHATSAPP,
} from "./copy";
import type { ShareView } from "./types";

export type ShareHandlers = {
  onCopyLink?: () => void;
  onCopyMessage?: () => void;
  onOtherMessage?: () => void;
  onPickDish?: (id: string) => void;
  onMoreDishes?: () => void;
  onRetry?: () => void;
  onFormat?: (id: "feed" | "status") => void;
  onBrand?: (on: boolean) => void;
  onSendFile?: () => void;
  onDownload?: () => void;
  onCopyCaption?: () => void;
  onOtherCaption?: () => void;
  onGoTables?: () => void;
};

type Props = ShareHandlers & {
  view: ShareView;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/** O texto que o celular não deixou copiar sozinho: aparece marcado, para a pessoa segurar e escolher Copiar. */
function ManualText({ text }: { text: string }) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, [text]);
  return (
    <div className="nv-share-manual">
      <p className="nv-hint">{SHARE_MANUAL}</p>
      <textarea ref={field} readOnly rows={4} value={text} aria-label="Texto para copiar" onFocus={(event) => event.currentTarget.select()} />
    </div>
  );
}

/**
 * Divulgar (o antigo "Meu link"): o link do restaurante, uma mensagem pronta para o WhatsApp e o cartão de um prato para
 * postar. Tudo começa no toque do dono: o WhatsApp abre com o texto pronto e é ele quem escolhe quem recebe; nada é enviado
 * sozinho. O cartão é uma imagem montada no próprio celular, com a foto, o nome e o preço do cadastro.
 */
export default function Share({ view, onMenu, showMenu = false, ...handlers }: Props) {
  const ready = view.load === "ready";
  const card = view.card;
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-share">
        <TopBar title={SHARE_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-share-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.live}
        </p>

        <p className="nv-code-hint">{SHARE_INTRO}</p>

        <section className="nv-order nv-share-box" aria-labelledby="nv-share-link">
          <h2 className="nv-h2" id="nv-share-link">
            {SHARE_LINK_TITLE}
          </h2>
          <p className="nv-share-url">{view.link}</p>
          <button type="button" className="nv-btn is-green is-block" onClick={handlers.onCopyLink}>
            <NvIcon name={view.copied === "link" ? "check" : "copy"} />
            {view.copied === "link" ? SHARE_COPIED_LINK : SHARE_COPY_LINK}
          </button>
          {view.manual?.id === "link" ? <ManualText text={view.manual.text} /> : null}
          <a className="nv-btn is-ghost is-block" href={view.openHref} target="_blank" rel="noopener noreferrer">
            <NvIcon name="link" />
            {SHARE_OPEN}
          </a>
        </section>

        <section className="nv-order nv-share-box" aria-labelledby="nv-share-message">
          <h2 className="nv-h2" id="nv-share-message">
            {SHARE_MESSAGE_TITLE}
          </h2>
          <p className="nv-code-hint">{SHARE_MESSAGE_HINT}</p>
          <p className="nv-share-bubble">{view.message}</p>
          <a className="nv-btn is-fire is-block" href={view.messageHref} target="_blank" rel="noopener noreferrer">
            <NvIcon name="chat" />
            {SHARE_WHATSAPP}
          </a>
          <div className="nv-share-pair">
            <button type="button" className="nv-btn is-ghost is-small" onClick={handlers.onCopyMessage}>
              <NvIcon name={view.copied === "message" ? "check" : "copy"} />
              {view.copied === "message" ? SHARE_COPIED_MESSAGE : SHARE_COPY_MESSAGE}
            </button>
            <button type="button" className="nv-btn is-ghost is-small" onClick={handlers.onOtherMessage}>
              <NvIcon name="sparkle" />
              {SHARE_OTHER_MESSAGE}
            </button>
          </div>
          {view.manual?.id === "message" ? <ManualText text={view.manual.text} /> : null}
        </section>

        <section className="nv-order nv-share-box" aria-labelledby="nv-share-dishes">
          <h2 className="nv-h2" id="nv-share-dishes">
            {SHARE_DISHES_TITLE}
          </h2>
          {view.load === "loading" ? <p className="nv-empty">{SHARE_DISHES_LOADING}</p> : null}
          {view.load === "error" ? (
            <>
              <p className="nv-error" role="alert">
                {view.error}
              </p>
              <button type="button" className="nv-btn is-ghost is-block" onClick={handlers.onRetry}>
                {SHARE_DISHES_RETRY}
              </button>
            </>
          ) : null}
          {ready && view.dishesHint ? <p className="nv-empty">{view.dishesHint}</p> : null}
          {ready && view.dishes.length > 0 ? (
            <>
              <p className="nv-code-hint">{SHARE_DISHES_HINT}</p>
              <ul className="nv-share-dishes">
                {view.dishes.map((dish) => (
                  <li key={dish.id}>
                    <button
                      type="button"
                      className={`nv-share-dish${dish.selected ? " is-on" : ""}`}
                      aria-pressed={dish.selected}
                      aria-label={dish.label}
                      onClick={() => handlers.onPickDish?.(dish.id)}
                    >
                      <Photo src={dish.photo ?? undefined} alt="" />
                      <span className="nv-share-dish-name">{dish.name}</span>
                      <span className="nv-share-dish-price">{dish.priceText}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {view.hiddenDishes > 0 ? (
                <button type="button" className="nv-btn is-ghost is-block" onClick={handlers.onMoreDishes}>
                  {SHARE_DISHES_MORE(view.hiddenDishes)}
                </button>
              ) : null}
            </>
          ) : null}

          {card ? (
            <div className="nv-share-card">
              <div className="nv-tabs is-two" role="group" aria-label={SHARE_FORMAT_TITLE}>
                {card.formats.map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    className={`nv-tab${format.selected ? " is-on" : ""}`}
                    aria-pressed={format.selected}
                    onClick={() => handlers.onFormat?.(format.id)}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
              <p className="nv-code-hint">{card.formats.find((format) => format.selected)?.hint}</p>

              <div className={`nv-share-preview is-${card.formats.find((format) => format.selected)?.id ?? "feed"}`}>
                {card.image ? <img src={card.image} alt={card.alt} /> : <p className="nv-empty">{card.busy ? SHARE_BUSY : ""}</p>}
              </div>
              {card.error ? (
                <p className="nv-error" role="alert">
                  {card.error}
                </p>
              ) : null}

              <label className="nv-share-check">
                <input type="checkbox" checked={card.brand} onChange={(event) => handlers.onBrand?.(event.currentTarget.checked)} />
                <span>{SHARE_BRAND}</span>
              </label>

              {card.canSendFile ? (
                <button type="button" className="nv-btn is-fire is-block" disabled={!card.image} onClick={handlers.onSendFile}>
                  <NvIcon name="share" />
                  {SHARE_SEND_FILE}
                </button>
              ) : null}
              <button type="button" className={`nv-btn is-block ${card.canSendFile ? "is-ghost" : "is-fire"}`} disabled={!card.image} onClick={handlers.onDownload}>
                <NvIcon name="download" />
                {SHARE_DOWNLOAD}
              </button>

              <h3 className="nv-share-sub">{SHARE_CAPTION_TITLE}</h3>
              <p className="nv-share-bubble">{card.caption}</p>
              <a className="nv-btn is-ghost is-block" href={card.captionHref} target="_blank" rel="noopener noreferrer">
                <NvIcon name="chat" />
                {SHARE_CAPTION_WHATSAPP}
              </a>
              <div className="nv-share-pair">
                <button type="button" className="nv-btn is-ghost is-small" onClick={handlers.onCopyCaption}>
                  <NvIcon name={view.copied === "caption" ? "check" : "copy"} />
                  {view.copied === "caption" ? SHARE_COPIED_CAPTION : SHARE_COPY_CAPTION}
                </button>
                <button type="button" className="nv-btn is-ghost is-small" onClick={handlers.onOtherCaption}>
                  <NvIcon name="sparkle" />
                  {SHARE_OTHER_CAPTION}
                </button>
              </div>
              {view.manual?.id === "caption" ? <ManualText text={view.manual.text} /> : null}
            </div>
          ) : null}
        </section>

        <section className="nv-share-where" aria-labelledby="nv-share-where">
          <h2 className="nv-h2" id="nv-share-where">
            {SHARE_WHERE_TITLE}
          </h2>
          <ul>
            <li>
              <strong>WhatsApp</strong>
              <span>{SHARE_WHERE_WHATSAPP}</span>
            </li>
            <li>
              <strong>Instagram</strong>
              <span>{SHARE_WHERE_INSTAGRAM}</span>
            </li>
            <li>
              <strong>Mesas</strong>
              <span>{SHARE_WHERE_TABLES}</span>
              <button type="button" className="nv-btn is-ghost is-small" onClick={handlers.onGoTables}>
                <NvIcon name="qr" />
                {SHARE_GO_TABLES}
              </button>
            </li>
          </ul>
        </section>
      </main>

      <div className="nv-dock">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
