import { useEffect, useState } from "react";
import "./styles.css";
import { fetchCompanyBySlug, getToken } from "./service/api";
import { lastCompany } from "./service/lastCompany";
import { entryScreen, panelUrl, wantsPanel } from "./service/links";
import AdminPanel from "./service/AdminPanel";
import CustomerApp from "./customer/CustomerApp";
import OwnerLinks from "./signup/OwnerLinks";
import OwnerLogin from "./signup/OwnerLogin";
import SignupPage from "./signup/SignupPage";
import TermsPage from "./signup/TermsPage";
import type { Company } from "./customer/types";

/**
 * Entry point. The address decides what opens:
 *   ?empresa=<slug>&mesa=<id>      customer menu (what the table QR code opens)
 *   ?empresa=<slug>&painel=1       owner panel
 *   ?cadastro=1 | ?entrar=1 | ?termos=1   owner sign-up, owner sign-in, terms of use
 *   nothing                        short explanation (or the panel, for a signed-in owner)
 */
export default function App() {
  const params = new URLSearchParams(location.search);

  // An owner who already signed in and opens the bare address (for example
  // from the home-screen icon) goes back to the panel of the same restaurant.
  const rememberedSlug = !params.get("empresa") && getToken() ? lastCompany() : null;

  const slug = params.get("empresa") || rememberedSlug;
  const tableId = params.get("mesa");

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState(false);
  const [admin, setAdmin] = useState(wantsPanel(location.search) || Boolean(rememberedSlug));

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    fetchCompanyBySlug(slug)
      .then((found: Company) => {
        if (alive) setCompany(found);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!slug) {
    // Telas de entrada do dono (sem restaurante escolhido ainda)
    const screen = entryScreen(location.search);
    if (screen === "signup") return <SignupPage />;
    if (screen === "login") return <OwnerLogin />;
    if (screen === "terms") return <TermsPage />;

    return (
      <main className="adm adm-login-page">
        <section className="adm-login sheet">
          <img className="adm-login-logo" src="/logo-vem-comer.png" alt="Vem Comer" />

          <div>
            <h1 className="adm-title">Escaneie o QR code da mesa</h1>
            <p className="adm-lead">
              Aponte a câmera do celular para o QR code da sua mesa. O cardápio abre na hora e você
              pede sem chamar o garçom.
            </p>
          </div>

          <OwnerLinks />
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="loading-state">Carregando…</main>;
  }

  if (error || !company) {
    return (
      <main className="error-state">
        <div>
          <p>Não encontramos este restaurante.</p>
          <p className="adm-muted">Confira o QR code ou o link que você recebeu.</p>
        </div>
      </main>
    );
  }

  if (admin) {
    return <AdminPanel companyId={company.id} companySlug={company.slug} onBack={() => setAdmin(false)} />;
  }

  return (
    <CustomerApp
      company={company}
      tableId={tableId}
      panelHref={panelUrl(location.origin, location.pathname, company.slug)}
    />
  );
}
