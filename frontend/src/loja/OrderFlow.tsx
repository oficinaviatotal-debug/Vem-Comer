import { useState } from "react";
import { TopBar } from "../novo/parts";
import { addConfigured, lineKey, replaceLine, type CartLine } from "../customer/cart";
import type { Company, Product } from "../customer/types";
import BagScreen, { type SentOrder } from "./BagScreen";
import ChoicesScreen, { initialOf } from "./ChoicesScreen";
import ShopScreen from "./ShopScreen";
import type { ChoicesPick } from "./choicesLogic";
import { useShop } from "./useShop";

type Props = {
  company: Company;
  /** Quem entrou pelo QR da mesa traz o código da mesa; senão null. */
  tableId: string | null;
  jobsHref?: string | null;
  /** O servidor aceitou o pedido. Quem monta o app leva a pessoa ao acompanhamento (e ao Pix, se for o caso). */
  onSent?: (order: SentOrder) => void;
};

type Screen = "menu" | "bag" | "sent";

/** O prato aberto nas escolhas; com `editKey`, é uma linha da sacola sendo mudada. */
type Picking = { product: Product; editKey?: string; line?: CartLine };

/**
 * O caminho do cliente no visual novo: cardápio, escolhas do prato, sacola e envio. Ainda não está ligado ao aplicativo
 * público: o acompanhamento do pedido e o Pix são as próximas telas, e o fluxo antigo continua valendo até lá.
 */
export default function OrderFlow({ company, tableId, jobsHref = null, onSent }: Props) {
  const shop = useShop(company, tableId);
  const [screen, setScreen] = useState<Screen>("menu");
  const [picking, setPicking] = useState<Picking | null>(null);

  const goTo = (next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0 });
  };

  const confirm = (pick: ChoicesPick) => {
    if (!picking) return;
    const { product, editKey } = picking;
    shop.setCart((current) => (editKey ? replaceLine(current, editKey, product, pick) : addConfigured(current, product, pick)));
    setPicking(null);
  };

  return (
    <>
      {screen === "menu" ? (
        <ShopScreen shop={shop} tableId={tableId} jobsHref={jobsHref} onChoose={(product) => setPicking({ product })} onBag={() => goTo("bag")} />
      ) : null}
      {screen === "bag" ? (
        <BagScreen
          company={company}
          tableId={tableId}
          shop={shop}
          onBack={() => goTo("menu")}
          onEditLine={(line) => {
            const product = shop.products.find((entry) => entry.id === line.id);
            if (product) setPicking({ product, editKey: lineKey(line), line });
          }}
          onSent={(order) => {
            goTo("sent");
            onSent?.(order);
          }}
        />
      ) : null}
      {screen === "sent" ? (
        <div className="nv-root">
          <main className="nv-screen">
            <TopBar title={shop.live.name} />
            <p className="nv-notice" role="status">
              Pedido enviado ao restaurante.
            </p>
            <button type="button" className="nv-btn is-green is-block" onClick={() => goTo("menu")}>
              Voltar ao cardápio
            </button>
          </main>
        </div>
      ) : null}
      {picking ? (
        <ChoicesScreen
          key={picking.editKey ?? picking.product.id}
          product={picking.product}
          initial={picking.line ? initialOf(picking.product, picking.line) : undefined}
          onConfirm={confirm}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </>
  );
}
