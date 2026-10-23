import { Suspense, lazy, useEffect, useState } from "react";
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
import { FLAG_KEY, readFlag } from "./painel/shellLogic";
import type { Company } from "./customer/types";

// O painel novo só é baixado por quem liga a chave (?novo=1): para todos os outros nada muda.
const PanelShell = lazy(() => import("./painel/PanelShell"));
// O mesmo vale para o pedido do cliente no visual novo: quem não liga a chave continua no aplicativo de sempre.
const OrderFlow = lazy(() => import("./loja/OrderFlow"));

/**
 * A chave do painel novo: desligada por padrão. `?novo=1` liga (e este aparelho lembra), `?novo=0` desliga.
 * Armazenamento bloqueado (aba privada) só faz a chave valer para esta abertura.
 */
function newPanelOn(): boolean {
  let remembered: string | null = null;
  try {
    remembered = window.localStorage.getItem(FLAG_KEY);
  } catch {
    /* sem armazenamento: vale só o endereço */
  }
  const flag = readFlag(location.search, remembered, import.meta.env.VITE_PAINEL_NOVO);
  if (flag.remember) {
    try {
      window.localStorage.setItem(FLAG_KEY, flag.remember);
    } catch {
      /* idem */
    }
  }
  return flag.on;
}

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
  const [freshPanel] = useState(newPanelOn);

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
    if (freshPanel) {
      return (
        <Suspense fallback={<main className="loading-state">Abrindo o painel…</main>}>
          <PanelShell companyId={company.id} companySlug={company.slug} companyName={company.name} onBack={() => setAdmin(false)} />
        </Suspense>
      );
    }
    return <AdminPanel companyId={company.id} companySlug={company.slug} companyName={company.name} onBack={() => setAdmin(false)} />;
  }

  if (freshPanel) {
    return (
      <Suspense fallback={<main className="loading-state">Carregando…</main>}>
        <OrderFlow company={company} tableId={tableId} teamHref={ownerLoginUrl(location.origin, location.pathname)} />
      </Suspense>
    );
  }

  return (
    <CustomerApp
      company={company}
      tableId={tableId}
      teamHref={ownerLoginUrl(location.origin, location.pathname)}
    />
  );
}
