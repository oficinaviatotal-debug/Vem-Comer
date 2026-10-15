import { useEffect, useState } from "react";
import "../ui.css";
import "../admin.css";
import "./nav.css";
import NavIcon from "./NavIcon";
import { fetchSignupStatus } from "../service/api";
import { salesUrl, signupUrl } from "../service/links";
import { TEAM_ENTRIES, entryRoleUrl } from "./navLogic";

/**
 * The first screen of the bare address (no restaurant chosen): one button per function.
 * The customer needs nothing here (the table's QR Code or the restaurant's link opens the menu directly);
 * the team taps what they do (kitchen, waiter, cashier, courier) and the owner taps the last button.
 * Every button leads to the same sign-in, so the account decides what opens: nobody gets a screen that is not theirs.
 */
export default function StartScreen() {
  const [signupOpen, setSignupOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSignupStatus().then((status) => {
      if (alive) setSignupOpen(status === "open");
    });
    return () => {
      alive = false;
    };
  }, []);

  const { origin, pathname } = window.location;

  return (
    <main className="st">
      <div className="st-wrap">
        <img className="st-logo" src="/logo-vem-comer.png" alt="Vem Comer" />

        <section className="st-card st-customer" aria-labelledby="st-customer-title">
          <span className="st-customer-icon" aria-hidden="true">
            <NavIcon name="qr" size={30} />
          </span>
          <div>
            <h1 id="st-customer-title" className="st-customer-title">
              Quer pedir?
            </h1>
            <p className="st-customer-text">
              Aponte a câmera do celular para o QR Code da sua mesa. O cardápio abre na hora, sem baixar nada. Ou abra o link que o
              restaurante mandou.
            </p>
          </div>
        </section>

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
          {signupOpen && (
            <a className="btn btn-primary btn-block" href={signupUrl(origin, pathname)}>
              Cadastrar meu restaurante
            </a>
          )}
          <a className="btn btn-quiet btn-block" href={salesUrl(origin, pathname)}>
            Conhecer o sistema
          </a>
        </section>
      </div>
    </main>
  );
}
