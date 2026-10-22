import "./novo.css";
import NvIcon from "./Icons";

/** Peças que as telas novas repartem. Só visual: nenhuma delas fala com o servidor. */

export function Photo({ src, art, alt }: { src?: string; art?: string; alt: string }) {
  return (
    <span className="nv-photo">
      {src ? <img src={src} alt={alt} loading="lazy" /> : <span aria-hidden="true">{art}</span>}
    </span>
  );
}

/** A bolinha de voz: o elemento de personalidade do Vem. Toda tela tem uma. */
export function VoiceOrb({ label = "Falar" }: { label?: string }) {
  return (
    <button type="button" className="nv-orb" aria-label={label}>
      <NvIcon name="mic" />
    </button>
  );
}

export function TopBar({ mark, title, sub }: { mark?: string; title: string; sub?: string }) {
  return (
    <header className="nv-top">
      {mark ? (
        <span className="nv-mark" aria-hidden="true">
          {mark}
        </span>
      ) : null}
      <div className="nv-top-text">
        <h1 className="nv-name">{title}</h1>
        {sub ? <p className="nv-sub">{sub}</p> : null}
      </div>
      <button type="button" className="nv-icon-btn" aria-label="Abrir o menu">
        <NvIcon name="menu" />
      </button>
    </header>
  );
}
