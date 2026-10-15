import "../ui.css";
import "../admin.css";
import "./nav.css";
import NavIcon from "./NavIcon";
import { TEAM_ENTRIES, entryRoleUrl } from "./navLogic";

/**
 * "Entrar": one big button per function, reached from the sales page (and from the small link at the bottom of each
 * restaurant's own page). The cook, the waiter, the cashier and the courier tap what they do; the owner and the
 * manager tap the last button. Every button leads to the same sign-in, so the account decides what opens: nobody gets a
 * screen that is not theirs.
 *
 * The bare address is NOT this screen: it is only the sales page of the service. Customers never come here; they open
 * the link of the restaurant they want, which goes straight to that menu.
 */
export default function StartScreen() {
  const { origin, pathname } = window.location;

  return (
    <main className="st">
      <div className="st-wrap">
        <img className="st-logo" src="/logo-vem-comer.png" alt="Vem Comer" />

        <header className="st-head">
          <h1 className="st-title">Entrar</h1>
          <p className="st-lead">Toque no que você faz. Depois é só o e-mail e a senha que o restaurante criou para você.</p>
        </header>

        <section aria-labelledby="st-team-title" className="st-section">
          <h2 id="st-team-title" className="st-heading">
            Eu trabalho aqui
          </h2>
          <div className="st-grid">
            {TEAM_ENTRIES.map((entry) => (
              <a key={entry.key} className={`st-role st-role-${entry.key}`} href={entryRoleUrl(origin, pathname, entry.key)}>
                <span className="st-role-icon">
                  <NavIcon name={entry.icon} size={28} />
                </span>
                <span className="st-role-label">{entry.label}</span>
                <span className="st-role-hint">{entry.hint}</span>
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="st-owner-title" className="st-section">
          <h2 id="st-owner-title" className="st-heading">
            Eu sou dono ou gerente
          </h2>
          <a className="st-owner" href={entryRoleUrl(origin, pathname, "dono")}>
            <span className="st-owner-icon">
              <NavIcon name="owner" size={28} />
            </span>
            <span className="st-owner-text">
              <span className="st-owner-label">Entrar no painel</span>
              <span className="st-owner-hint">Pedidos, cardápio e números do restaurante</span>
            </span>
            <NavIcon name="chevron" size={22} />
          </a>
          <a className="btn btn-quiet btn-block" href={pathname || "/"}>
            Voltar
          </a>
        </section>
      </div>
    </main>
  );
}
