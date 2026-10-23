import "./novo.css";
import NvIcon from "./Icons";
import { useVoice } from "./voice";

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

/** A roda que gira enquanto o servidor responde. Só enfeite: a frase ao lado diz o que acontece. */
export function Spinner() {
  return <span className="nv-spin" aria-hidden="true" />;
}

/** A frase que o leitor de tela ouve a cada mudança no montar o cardápio. Sempre na página: só se anuncia o que muda dentro de uma região que já existia. */
export function MenuLive({ text }: { text: string }) {
  return (
    <p className="nv-sr" id="nv-menu-live" role="status" aria-live="polite" tabIndex={-1}>
      {text}
    </p>
  );
}

/**
 * A bolinha de voz: o elemento de personalidade do Vem. Toda tela tem uma.
 * Com `onPress` ela faz o que a tela quer (o Assistente do cardápio escuta os pratos). Sem `onPress` ela usa a voz do
 * painel (`novo/voice.ts`), que abre telas; fora do painel (conferência de imagem) ela só enfeita a tela.
 * `listening` mostra que o celular está ouvindo: a bolinha escurece, o ícone pulsa e o leitor de tela ouve "pressionado".
 */
export function VoiceOrb({ label = "Falar", onPress, listening }: { label?: string; onPress?: () => void; listening?: boolean }) {
  const panel = useVoice();
  // A tela que passa o próprio `onPress` manda em tudo; só sem ele vale a voz do painel.
  const own = onPress !== undefined;
  const press = own ? onPress : panel?.onPress;
  const hearing = own ? listening : panel?.listening;
  return (
    <button
      type="button"
      className={`nv-orb${hearing ? " is-listening" : ""}`}
      aria-label={label}
      aria-pressed={hearing === undefined ? undefined : hearing}
      onClick={press}
    >
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
