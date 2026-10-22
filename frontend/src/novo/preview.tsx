import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import Kitchen from "./Kitchen";
import OwnerToday from "./OwnerToday";
import JobsHome from "./JobsHome";
import ShopMenu from "./ShopMenu";
import { emptyText, isKitchenTab, kitchenTabs, ticketsFor, type KitchenTabId } from "../cozinha/kitchenLogic";
import { JOBS, PROMO, kitchenOrders, shopExample, todayExample } from "./demo";

/**
 * Página de conferência do visual novo (não faz parte do aplicativo): mostra cada tela com dados de exemplo.
 * Abrir: preview-novo.html#/loja, #/hoje, #/cozinha ou #/vagas.
 */
/** O cardápio da conferência: dados de exemplo passando pela conta de verdade; adicionar e tirar funcionam na tela. */
function ShopPreview() {
  const view = shopExample();
  const [quantities, setQuantities] = useState<Record<string, number>>({ a2: 2 });
  const groups = view.groups.map((group) => ({
    ...group,
    sections: group.sections.map((section) => ({
      ...section,
      dishes: section.dishes.map((dish) => ({ ...dish, quantity: quantities[dish.id] ?? 0 })),
    })),
  }));
  const price = new Map(groups.flatMap((g) => g.sections.flatMap((s) => s.dishes)).map((dish) => [dish.id, dish.price]));
  const items = Object.values(quantities).reduce((sum, n) => sum + n, 0);
  const total = Object.entries(quantities).reduce((sum, [id, n]) => sum + (price.get(id) ?? 0) * n, 0);
  const change = (id: string, by: number) => setQuantities((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + by) }));
  return (
    <ShopMenu
      {...view}
      promo={PROMO}
      groups={groups}
      cart={{ items, total }}
      onAdd={(id) => change(id, 1)}
      onLess={(id) => change(id, -1)}
      onPromo={() => change("a1", 1)}
      onPromos={() => undefined}
      showMenu
      jobsHref="#"
    />
  );
}

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
      showMenu
    />
  );
}

function Screen() {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "hoje") return <OwnerToday today={todayExample(Date.now())} showMenu />;
  if (route === "vagas") return <JobsHome jobs={JOBS} city="Natal - RN" showMenu />;
  if (route === "cozinha") return <KitchenPreview />;
  return <ShopPreview />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Screen />
  </React.StrictMode>,
);
