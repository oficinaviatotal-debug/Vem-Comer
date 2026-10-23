import { useRef, useState } from "react";
import "../ui.css";
import "../admin.css";
import "./nav.css";
import NavIcon from "./NavIcon";
import { copyText } from "../service/clipboard";
import { restaurantUrl } from "../service/links";
import { shareMessage, whatsappShareUrl } from "./navLogic";

type Props = {
  /** The restaurant's address name (the part after ?empresa=). */
  slug: string;
  /** The restaurant's name, for the message that goes with the link. */
  name: string;
  onGo: (view: string) => void;
};

type Copy = "idle" | "done" | "failed";

/**
 * "Meu link": the restaurant's own link, ready to send. Every restaurant has a link only its own; whoever taps it opens
 * that menu directly (no list of other restaurants, no sign-up in the way). The owner copies it, sends it on WhatsApp
 * or puts it on his Instagram.
 */
export default function ShareLinkView({ slug, name, onGo }: Props) {
  const url = restaurantUrl(window.location.origin, window.location.pathname, slug);
  const field = useRef<HTMLTextAreaElement>(null);
  const [copy, setCopy] = useState<Copy>("idle");

  async function handleCopy() {
    const ok = await copyText(url, field.current);
    setCopy(ok ? "done" : "failed");
  }

  return (
    <section className="sl" aria-label="Meu link">
      <p className="sl-lead">
        Este é o link do seu restaurante. Quem tocar nele abre o seu cardápio na hora, sem baixar nada e sem ver
        nenhum outro restaurante.
      </p>

      <div className="sheet sl-card">
        <label className="field">
          <span>Seu link</span>
          <textarea
            ref={field}
            className="sl-url"
            readOnly
            rows={3}
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>

        <button type="button" className="btn btn-primary btn-block" onClick={handleCopy}>
          <NavIcon name="link" size={20} /> Copiar o link
        </button>
        <p className="sl-status" role="status" aria-live="polite">
          {copy === "done" && "Link copiado. Agora é só colar."}
          {copy === "failed" && "Não consegui copiar sozinho. Aperte e segure o link acima e escolha Copiar."}
        </p>

        <a className="btn btn-outline btn-block" href={whatsappShareUrl(shareMessage(name, url))} target="_blank" rel="noopener noreferrer">
          Mandar no WhatsApp
        </a>
        <a className="btn btn-quiet btn-block" href={url} target="_blank" rel="noopener noreferrer">
          Abrir para conferir
        </a>
      </div>

      <h2 className="sl-h2">Onde colocar</h2>
      <ul className="sl-where">
        <li>
          <strong>WhatsApp</strong>
          <span>Mande para os clientes e para os grupos. Quem toca já vê o cardápio.</span>
        </li>
        <li>
          <strong>Instagram</strong>
          <span>Cole no campo de link do seu perfil. Quem chega pela página já pede.</span>
        </li>
        <li>
          <strong>Mesas</strong>
          <span>Cada mesa tem o QR Code dela, na tela Mesas.</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onGo("mesas")}>
            Ir para Mesas
          </button>
        </li>
      </ul>
    </section>
  );
}
