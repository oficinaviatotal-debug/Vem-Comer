import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import LegacyFrame from "../novo/LegacyFrame";
import Notices from "../novo/Notices";
import VoiceBubble from "../novo/VoiceBubble";
import { VoiceContext } from "../novo/voice";
import { SHELL_OLD_FAIL, SHELL_OLD_LOADING, SHELL_OPENING, SHELL_RETRY } from "../novo/copy";
import CategoriesScreen from "./CategoriesScreen";
import DeliveriesScreen from "./DeliveriesScreen";
import DeskScreen from "./DeskScreen";
import DishesScreen from "./DishesScreen";
import LoginScreen from "./LoginScreen";
import LogoScreen from "./LogoScreen";
import MenuSetupScreen from "./MenuSetupScreen";
import OrdersScreen from "./OrdersScreen";
import PanelMenu from "./PanelMenu";
import SettleScreen from "./SettleScreen";
import KitchenScreen from "../cozinha/KitchenScreen";
import TodayScreen from "../hoje/TodayScreen";
import { isManager, viewTitle } from "../nav/navLogic";
import { ADMIN_TOUR_ID } from "../onboarding/adminTour";
import { hasSeenGuide, markGuideSeen } from "../onboarding/guideStorage";
import { fetchProducts } from "../service/api";
import { roleLabel } from "../service/format";
import { suggestedTopic } from "../service/helpLogic";
import { tableOrderUrl } from "../service/links";
import { bannerOf, hasPlanTab, viewAllowed } from "../service/subscriptionView";
import { useOwnerPlan } from "../service/useOwnerPlan";
import { allowedViews, noticesOf, ownerStartView, screenOf, shownView, watchCalls, watchOrders, type ShellContext } from "./shellLogic";
import { useSession, type SessionUser } from "./useSession";
import { readBriefing } from "./readBriefing";
import { useVoiceNav } from "./useVoiceNav";
import { useCallsWatch, useOrdersWatch, usePlatformCounts } from "./useWatchers";

type Props = {
  companyId: string;
  companySlug: string;
  /** Para as mensagens do dono sobre o plano ("Quero pagar o plano do restaurante ...") e para o topo do menu. */
  companyName?: string;
  /** "Ver o cardápio do cliente". */
  onBack: () => void;
};

// As telas antigas e as faixas antigas só são baixadas quando alguém precisa delas.
const LegacyView = lazy(() => import("./legacyPanels"));
const PauseExtra = lazy(() => import("./legacyPanels").then((module) => ({ default: module.PauseExtra })));
const PushExtra = lazy(() => import("./legacyPanels").then((module) => ({ default: module.PushExtra })));
const HelpOverlay = lazy(() => import("./legacyPanels").then((module) => ({ default: module.HelpOverlay })));
const CourierView = lazy(() => import("./legacyPanels").then((module) => ({ default: module.CourierView })));

/** Se uma peça antiga não abrir (sem sinal ao baixar), a pessoa recebe uma frase e um botão, nunca uma tela em branco. */
class Catch extends Component<{ children: ReactNode; quiet?: boolean }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.quiet) return null;
    return (
      <>
        <p className="nv-error" role="alert">
          {SHELL_OLD_FAIL}
        </p>
        <button type="button" className="nv-btn is-green is-block" onClick={() => window.location.reload()}>
          {SHELL_RETRY}
        </button>
      </>
    );
  }
}

function Opening({ text }: { text: string }) {
  return (
    <div className="nv-root">
      <main className="nv-screen">
        <p className="nv-empty" role="status">
          {text}
        </p>
      </main>
    </div>
  );
}

/**
 * O painel de quem trabalha no restaurante, versão nova: entra, escolhe a tela pelo menu e liga todas as telas novas
 * (Hoje, Pedidos, Cozinha, Mesa, Entregas, Acerto, Assistente, Produtos, Categorias e Marca). As que ainda não foram
 * refeitas abrem dentro de uma moldura nova, funcionando como sempre. Quem pode abrir o quê vem do menu
 * (`shellLogic.shownView`); o painel antigo continua sendo o que abre enquanto a chave `?novo=1` não for ligada.
 */
export default function PanelShell(props: Props) {
  const session = useSession();

  if (!session.user) {
    return (
      <LoginScreen
        place={props.companyName}
        slug={props.companySlug}
        email={session.lastEmail}
        ended={session.ended}
        onSignedIn={session.enter}
        onBack={props.onBack}
      />
    );
  }

  if (session.user.role === "COURIER") {
    return (
      <Catch>
        <Suspense fallback={<Opening text={SHELL_OPENING} />}>
          <CourierView companyId={props.companyId} name={session.user.name} onLogout={session.leave} onBack={props.onBack} />
        </Suspense>
      </Catch>
    );
  }

  return <Panel {...props} user={session.user} onLogout={session.leave} />;
}

function Panel({ companyId, companySlug, companyName, onBack, user, onLogout }: Props & { user: SessionUser; onLogout: () => void }) {
  const role = user.role;
  const manager = isManager(role);

  // O plano: o aviso no alto, a tela Plano e, bloqueado, as únicas telas que abrem. Ler o plano nunca quebra o painel.
  const { plan } = useOwnerPlan(manager);
  const planBlocked = plan?.blocked === true;
  const platformAdmin = plan?.platform_admin === true;
  const platform = usePlatformCounts(platformAdmin);

  const [view, setView] = useState("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const context: ShellContext = { role, planBlocked, hasPlanTab: Boolean(plan && hasPlanTab(plan)), platformAdmin };
  const shown = shownView(view, context);
  const screen = screenOf(shown, role);

  const orders = useOrdersWatch(companyId, {
    poll: watchOrders({ view: shown, role, menuOpen }),
    alert: watchOrders({ view: shown, role, menuOpen: false }),
  });
  const callsCount = useCallsWatch(companyId, watchCalls({ view: shown, role }));

  const go = useCallback((next: string) => {
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  // A bolinha de voz de todas as telas: falar o nome de uma tela abre a tela (e responde na tela e em voz alta).
  const voice = useVoiceNav({
    role,
    allowed: allowedViews(context),
    current: shown,
    onGo: go,
    onBrief: () => readBriefing({ companyId, role, name: user.name }),
  });
  const voiceControl = useMemo(() => ({ onPress: voice.press, listening: voice.listening }), [voice.press, voice.listening]);

  // No instante em que o restaurante fica bloqueado, a pessoa cai em como pagar; os Pedidos continuam a um toque.
  useEffect(() => {
    if (planBlocked) setView("plano");
  }, [planBlocked]);

  // Quem está nos Pedidos já está vendo o pedido novo.
  const { clear: clearFresh } = orders;
  useEffect(() => {
    if (shown === "pedidos") clearFresh();
  }, [shown, clearFresh]);

  // A primeira vez do dono neste aparelho: com o cardápio vazio, direto ao Assistente (voz e foto, sem digitar).
  useEffect(() => {
    if (role !== "OWNER" || hasSeenGuide(ADMIN_TOUR_ID, user.id)) return;
    let alive = true;
    fetchProducts(companyId)
      .then((rows) => {
        // Sem resposta de verdade nunca se conclui "cardápio vazio" (e a próxima entrada tenta de novo).
        if (!alive || !Array.isArray(rows)) return;
        markGuideSeen(ADMIN_TOUR_ID, user.id);
        const start = ownerStartView({ role, seen: false, planBlocked: false, products: rows.length });
        if (start === "assistente") setView((now) => (now === "inicio" ? start : now));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [companyId, role, user.id]);

  const notices = noticesOf({ view: shown, role, plan: bannerOf(plan, shown), newOrder: orders.fresh, calls: callsCount });
  const tableUrl = (tableId: string) => tableOrderUrl(window.location.origin, window.location.pathname, companySlug, tableId);
  const person = `${user.name}, ${roleLabel(role)}`;
  const pauses = shown === "pedidos" && (role === "OWNER" || role === "MANAGER" || role === "KITCHEN");

  function body() {
    if (screen.kind === "old") {
      return (
        <LegacyFrame title={viewTitle(shown, role)} sub={person} onMenu={openMenu}>
          <Catch>
            <Suspense
              fallback={
                <p className="adm-status" role="status">
                  {SHELL_OLD_LOADING}
                </p>
              }
            >
              <LegacyView
                screen={screen.id}
                companyId={companyId}
                slug={companySlug}
                name={companyName ?? ""}
                role={role}
                plan={plan}
                onGo={go}
                onApprovals={platform.setApprovals}
                onHelp={platform.setHelp}
              />
            </Suspense>
          </Catch>
        </LegacyFrame>
      );
    }
    switch (screen.id) {
      case "today":
        return <TodayScreen key="today" companyId={companyId} role={role} name={user.name} onGo={go} onMenu={openMenu} />;
      case "orders":
        return <OrdersScreen key="orders" companyId={companyId} role={role} onMenu={openMenu} />;
      case "kitchen":
        return <KitchenScreen key="kitchen" companyId={companyId} role={role} onMenu={openMenu} />;
      case "desk":
        return <DeskScreen key={shown} companyId={companyId} slug={companySlug} tableUrl={tableUrl} onMenu={openMenu} />;
      case "deliveries":
        return <DeliveriesScreen key="deliveries" companyId={companyId} onMenu={openMenu} />;
      case "settle":
        return <SettleScreen key="settle" companyId={companyId} onMenu={openMenu} />;
      case "setup":
        return <MenuSetupScreen key="setup" companyId={companyId} onMenu={openMenu} onSeeMenu={() => go("produtos")} />;
      case "dishes":
        return <DishesScreen key="dishes" companyId={companyId} canManage={manager} onMake={() => go("assistente")} onMenu={openMenu} />;
      case "categories":
        return <CategoriesScreen key="categories" companyId={companyId} onMenu={openMenu} />;
      case "logo":
        return <LogoScreen key="logo" companyId={companyId} onBack={() => go("inicio")} onMenu={openMenu} />;
    }
  }

  return (
    <VoiceContext.Provider value={voiceControl}>
      <Notices
        notices={notices.map(({ id, tone, text, action }) => ({ id, tone, text, action }))}
        onAct={(id) => {
          const notice = notices.find((item) => item.id === id);
          if (!notice) return;
          if (notice.id === "order") orders.clear();
          go(notice.view);
        }}
      />

      {pauses ? (
        <Catch quiet>
          <Suspense fallback={null}>
            <PauseExtra />
          </Suspense>
        </Catch>
      ) : null}
      {shown === "inicio" ? (
        <Catch quiet>
          <Suspense fallback={null}>
            <PushExtra companyId={companyId} />
          </Suspense>
        </Catch>
      ) : null}

      {body()}

      {menuOpen ? (
        <PanelMenu
          role={role}
          allowed={(screenName) => viewAllowed(screenName, planBlocked)}
          hasPlanTab={context.hasPlanTab}
          platformAdmin={platformAdmin}
          openOrders={orders.open ?? 0}
          helpCount={platform.help}
          approvalsCount={platform.approvals}
          current={shown}
          place={companyName}
          personName={user.name}
          canHelp={manager}
          onSelect={go}
          onClose={() => setMenuOpen(false)}
          onCustomer={onBack}
          onHelp={manager ? () => setHelpOpen(true) : undefined}
          onLogout={onLogout}
        />
      ) : null}

      {helpOpen && manager ? (
        <Catch quiet>
          <Suspense fallback={null}>
            <HelpOverlay screen={shown} suggested={suggestedTopic(shown)} onClose={() => setHelpOpen(false)} />
          </Suspense>
        </Catch>
      ) : null}

      {voice.caption && !menuOpen ? (
        <VoiceBubble tone={voice.caption.tone} text={voice.caption.text} heard={voice.caption.heard} onClose={voice.close} />
      ) : null}
    </VoiceContext.Provider>
  );
}
