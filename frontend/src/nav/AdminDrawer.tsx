import { useEffect, useRef } from "react";
import NavIcon, { type NavIconName } from "./NavIcon";
import type { NavGroup } from "./navLogic";
import "../ui.css";
import "./nav.css";

export type DrawerAction = {
  id: string;
  label: string;
  icon: NavIconName;
  onClick: () => void;
  /** The quiet red-ish row at the bottom (Sair). */
  quiet?: boolean;
};

type Props = {
  groups: NavGroup[];
  /** The screen on show: its row is marked and gets the focus when the menu opens. */
  current: string;
  /** Top of the menu: the restaurant and who is signed in. */
  place: string;
  person: string;
  actions: DrawerAction[];
  onSelect: (view: string) => void;
  onClose: () => void;
  /** The guide is talking: it keeps the menu open for the step that points into it, so the shade must not close it. */
  guided: boolean;
};

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * The menu of three lines: opens from the left over the screen, groups the panel's functions by subject and ends
 * with the things that are not screens (the customer's menu, the guide, help, sign out).
 *
 * Keyboard and screen readers: it is a dialog, Esc closes it, Tab stays inside while it is open, and the focus goes
 * back to the button that opened it. Every row is a real button with the screen's name written on it.
 */
export default function AdminDrawer({ groups, current, place, person, actions, onSelect, onClose, guided }: Props) {
  const drawer = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Remember who had the focus, move it inside, and give it back on the way out.
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target =
      drawer.current?.querySelector<HTMLElement>('[aria-current="page"]') ??
      drawer.current?.querySelector<HTMLElement>(FOCUSABLE);
    if (!guided) target?.focus({ preventScroll: true });
    return () => {
      if (opener.current && document.contains(opener.current)) opener.current.focus({ preventScroll: true });
    };
    // Only on opening and closing.
  }, []);

  // The page behind does not scroll while the menu is open.
  useEffect(() => {
    document.documentElement.classList.add("nav-open");
    return () => document.documentElement.classList.remove("nav-open");
  }, []);

  // Esc closes, Tab stays inside. While the guide talks, the guide owns the keyboard.
  useEffect(() => {
    if (guided) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawer.current) return;
      const items = Array.from(drawer.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [guided, onClose]);

  return (
    <div className={guided ? "nav-layer is-guided" : "nav-layer"}>
      <button type="button" className="nav-scrim" aria-label="Fechar o menu" tabIndex={-1} onClick={onClose} />

      <nav ref={drawer} id="admin-menu" className="nav-drawer" role="dialog" aria-modal="true" aria-label="Menu do painel">
        <header className="nav-head">
          <div className="nav-head-text">
            <p className="nav-place">{place}</p>
            {person && <p className="nav-person">{person}</p>}
          </div>
          <button type="button" className="nav-close" aria-label="Fechar o menu" onClick={onClose}>
            <NavIcon name="close" />
          </button>
        </header>

        <div className="nav-scroll">
          {groups.map((group) => (
            <section key={group.key} className="nav-group" aria-label={group.title ?? "Início"}>
              {group.title && <h2 className="nav-group-title">{group.title}</h2>}
              <ul className="nav-list">
                {group.items.map((item) => (
                  <li key={item.view}>
                    <button
                      id={`admin-tab-${item.view}`}
                      type="button"
                      className={current === item.view ? "nav-item is-active" : "nav-item"}
                      aria-current={current === item.view ? "page" : undefined}
                      onClick={() => onSelect(item.view)}
                    >
                      <span className="nav-item-icon">
                        <NavIcon name={item.icon} />
                      </span>
                      <span className="nav-item-text">
                        <span className="nav-item-label">{item.label}</span>
                        <span className="nav-item-hint">{item.hint}</span>
                      </span>
                      {item.badge !== null && (
                        <span className="nav-badge" aria-label={`${item.badge} em aberto`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="nav-group nav-foot" aria-label="Mais">
            <ul className="nav-list">
              {actions.map((action) => (
                <li key={action.id}>
                  <button
                    id={action.id}
                    type="button"
                    className={action.quiet ? "nav-action is-quiet" : "nav-action"}
                    onClick={action.onClick}
                  >
                    <NavIcon name={action.icon} size={22} />
                    <span>{action.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </nav>
    </div>
  );
}
