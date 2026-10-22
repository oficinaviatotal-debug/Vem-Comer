import "./novo.css";
import NvIcon from "./Icons";
import type { MenuAction, MenuItem, MenuView } from "./types";

type Props = {
  menu: MenuView;
  /** Toque numa tela do menu. */
  onSelect?: (view: string) => void;
  /** Toque numa ação que não é tela (ver o cardápio do cliente, pedir ajuda, sair). */
  onAction?: (id: string) => void;
  /** Fechar: o X, o toque fora do menu e a tecla Esc (quem monta a tela escuta o Esc). */
  onClose?: () => void;
};

function Row({ item, onSelect }: { item: MenuItem; onSelect?: (view: string) => void }) {
  return (
    <li>
      <button
        type="button"
        className={`nv-menu-item${item.current ? " is-current" : ""}`}
        aria-current={item.current ? "page" : undefined}
        onClick={() => onSelect?.(item.view)}
      >
        <span className="nv-menu-icon" aria-hidden="true">
          <NvIcon name={item.icon} />
        </span>
        <span className="nv-menu-text">
          <span className="nv-menu-label">{item.label}</span>
          <span className="nv-menu-hint">{item.hint}</span>
        </span>
        {item.badge !== null ? (
          <>
            <span className="nv-menu-badge" aria-hidden="true">
              {item.badge}
            </span>
            <span className="nv-sr">{item.badgeSpoken}</span>
          </>
        ) : null}
      </button>
    </li>
  );
}

function Action({ action, onAction }: { action: MenuAction; onAction?: (id: string) => void }) {
  return (
    <li>
      <button type="button" className={`nv-btn is-ghost is-block${action.quiet ? " is-quiet" : ""}`} onClick={() => onAction?.(action.id)}>
        <NvIcon name={action.icon} />
        {action.label}
      </button>
    </li>
  );
}

/**
 * O menu geral de quem trabalha no restaurante: abre do lado do botão de menu, por cima da tela, e leva a cada
 * função, agrupadas por assunto. Cada linha é um cartão que se toca (borda grossa embaixo, afunda no toque); a tela em
 * que a pessoa está fica afundada e verde, e é anunciada como "página atual" para o leitor de tela.
 * Quem monta cuida do que é de fora do desenho: travar a rolagem de trás, o Esc, o foco entrando e voltando.
 */
export default function MainMenu({ menu, onSelect, onAction, onClose }: Props) {
  return (
    <div className="nv-root nv-overlay">
      <div
        className="nv-backdrop is-side"
        onClick={(event) => {
          // Qualquer toque fora do menu fecha (a moldura à esquerda dele também).
          if (!(event.target as HTMLElement).closest(".nv-drawer")) onClose?.();
        }}
      >
        <div className="nv-drawer-frame">
          <div className="nv-drawer" role="dialog" aria-modal="true" aria-labelledby="nv-menu-title">
            <header className="nv-drawer-head">
              <div className="nv-drawer-who">
                <h2 id="nv-menu-title" tabIndex={-1}>
                  {menu.place}
                </h2>
                {menu.person ? <p>{menu.person}</p> : null}
              </div>
              <button type="button" className="nv-icon-btn" aria-label="Fechar o menu" onClick={onClose}>
                <NvIcon name="close" />
              </button>
            </header>

            <nav className="nv-drawer-scroll" aria-label="Menu do painel">
              {menu.groups.map((group) => (
                <section key={group.key} className="nv-menu-group" aria-label={group.title ?? "Início"}>
                  {group.title ? <h3>{group.title}</h3> : null}
                  <ul className="nv-menu-list">
                    {group.items.map((item) => (
                      <Row key={item.view} item={item} onSelect={onSelect} />
                    ))}
                  </ul>
                </section>
              ))}

              {menu.actions.length > 0 ? (
                <section className="nv-menu-group" aria-label="Mais">
                  <ul className="nv-menu-list">
                    {menu.actions.map((action) => (
                      <Action key={action.id} action={action} onAction={onAction} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
