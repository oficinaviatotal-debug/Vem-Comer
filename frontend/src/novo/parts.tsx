import "./novo.css";
import NvIcon from "./Icons";

/** Peças que as telas novas repartem. Só visual: nenhuma delas fala com o servidor. */

export function Photo({ src, art, alt }: { src?: string; art?: string; alt: string }) {
  return (
    <span className="nv-photo">
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : art ? (
        <span aria-hidden="true">{art}</span>
      ) : (
        <span className="nv-photo-empty" aria-hidden="true">
          <NvIcon name="fork" />
        </span>
      )}
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

/**
 * O topo de toda tela. `logo` é a logomarca de verdade do restaurante; `mark` é um emoji (só na conferência).
 * O botão de menu só aparece quando a tela tem para onde levar (`onMenu`) ou na conferência (`showMenu`): botão que não leva a lugar nenhum não entra.
 */
export function TopBar({
  mark,
  logo,
  title,
  sub,
  onMenu,
  showMenu = false,
}: {
  mark?: string;
  logo?: string;
  title: string;
  sub?: string;
  onMenu?: () => void;
  showMenu?: boolean;
}) {
  return (
    <header className="nv-top">
      {logo ? (
        <img className="nv-mark nv-mark-img" src={logo} alt="" width={52} height={52} />
      ) : mark ? (
        <span className="nv-mark" aria-hidden="true">
          {mark}
        </span>
      ) : null}
      <div className="nv-top-text">
        <h1 className="nv-name">{title}</h1>
        {sub ? <p className="nv-sub">{sub}</p> : null}
      </div>
      {showMenu || onMenu ? (
        <button type="button" className="nv-icon-btn" aria-label="Abrir o menu" onClick={onMenu}>
          <NvIcon name="menu" />
        </button>
      ) : null}
    </header>
  );
}
