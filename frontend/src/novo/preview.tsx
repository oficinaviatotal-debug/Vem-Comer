import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import Kitchen from "./Kitchen";
import OwnerToday from "./OwnerToday";
import JobsHome from "./JobsHome";
import ShopMenu from "./ShopMenu";
import { emptyText, isKitchenTab, kitchenTabs, ticketsFor, type KitchenTabId } from "../cozinha/kitchenLogic";
import { CART, CATEGORIES, DISHES, JOBS, PROMO, SHOP, TODAY, kitchenOrders } from "./demo";

/**
 * Página de conferência do visual novo (não faz parte do aplicativo): mostra cada tela com dados de exemplo.
 * Abrir: preview-novo.html#/loja, #/hoje, #/cozinha ou #/vagas.
 */
/** A cozinha da conferência: pedidos de exemplo passando pela conta de verdade; as etapas respondem ao toque. */
function KitchenPreview() {
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<KitchenTabId>("new");
  const orders = kitchenOrders(now);
  return (
    <Kitchen
      tabs={kitchenTabs(orders)}
      activeTab={tab}
      tickets={ticketsFor(orders, tab, now)}
      onTab={(id) => (isKitchenTab(id) ? setTab(id) : undefined)}
      emptyText={emptyText(tab)}
    />
  );
}

function Screen() {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "hoje") return <OwnerToday today={TODAY} />;
  if (route === "vagas") return <JobsHome jobs={JOBS} city="Natal - RN" />;
  if (route === "cozinha") return <KitchenPreview />;
  return <ShopMenu shop={SHOP} categories={CATEGORIES} promo={PROMO} dishes={DISHES} cart={CART} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Screen />
  </React.StrictMode>,
);
