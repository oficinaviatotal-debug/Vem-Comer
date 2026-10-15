import { useEffect, useState } from "react";
import "./styles.css";
import { fetchCompanyBySlug, getToken } from "./service/api";
import { lastCompany } from "./service/lastCompany";
import { entryScreen, ownerLoginUrl, wantsPanel } from "./service/links";
import AdminPanel from "./service/AdminPanel";
import CustomerApp from "./customer/CustomerApp";
import StartScreen from "./nav/StartScreen";
import { entryRoleFromSearch } from "./nav/navLogic";
import OwnerLogin from "./signup/OwnerLogin";
import SalesPage from "./signup/SalesPage";
import SignupPage from "./signup/SignupPage";
import TermsPage from "./signup/TermsPage";
import type { Company } from "./customer/types";

/**
 * Entry point. The address decides what opens:
 *   ?empresa=<slug>&mesa=<id>      customer menu (what the table QR code opens)
 *   ?empresa=<slug>&painel=1       owner panel
 *   ?cadastro=1 | ?entrar=1 | ?termos=1 | ?sistema=1   owner sign-up, sign-in, terms of use, sales page
 *   ?entrar=1                      one button per function (cook, waiter, cashier, courier, owner)
 *   ?entrar=1&funcao=<function>    sign-in for that function
 *   nothing                        the sales page of the service ONLY (or the panel, for someone signed in)
 *
 * Each restaurant has its own link (?empresa=<slug>): it opens that menu directly. The bare address never lists
 * restaurants and never takes orders: it only sells the service.
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
    if (screen === "login") return entryRoleFromSearch(location.search) ? <OwnerLogin /> : <StartScreen />;
    if (screen === "terms") return <TermsPage />;

    // The bare address and ?sistema=1 are the same page: the sales page of the service.
    return <SalesPage />;
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
    return <AdminPanel companyId={company.id} companySlug={company.slug} companyName={company.name} onBack={() => setAdmin(false)} />;
  }

  return (
    <CustomerApp
      company={company}
      tableId={tableId}
      teamHref={ownerLoginUrl(location.origin, location.pathname)}
    />
  );
}
