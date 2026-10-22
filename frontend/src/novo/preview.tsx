import React from "react";
import ReactDOM from "react-dom/client";
import Kitchen from "./Kitchen";
import OwnerToday from "./OwnerToday";
import JobsHome from "./JobsHome";
import ShopMenu from "./ShopMenu";
import { CART, CATEGORIES, DISHES, JOBS, KITCHEN_TABS, PROMO, SHOP, TICKETS, TODAY } from "./demo";

/**
 * Página de conferência do visual novo (não faz parte do aplicativo): mostra cada tela com dados de exemplo.
 * Abrir: preview-novo.html#/loja, #/hoje, #/cozinha ou #/vagas.
 */
function Screen() {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "hoje") return <OwnerToday today={TODAY} />;
  if (route === "vagas") return <JobsHome jobs={JOBS} city="Natal - RN" />;
  if (route === "cozinha") return <Kitchen tabs={KITCHEN_TABS} activeTab="new" tickets={TICKETS} />;
  return <ShopMenu shop={SHOP} categories={CATEGORIES} promo={PROMO} dishes={DISHES} cart={CART} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Screen />
  </React.StrictMode>,
);
