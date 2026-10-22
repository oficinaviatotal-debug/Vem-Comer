import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ShopMenu from "../novo/ShopMenu";
import { TopBar } from "../novo/parts";
import { addToCart, decrementItem, type CartLine } from "../customer/cart";
import { dropSoldOut, soldOutNotice } from "../customer/openness";
import type { Company, Menu, Product } from "../customer/types";
import { fetchCompanyBySlug, fetchMenus, fetchProducts, fetchTable, mediaUrl } from "../service/api";
import { shopViewOf } from "./shopLogic";

type Props = {
  company: Company;
  /** Quem entrou pelo QR da mesa traz o número da mesa; senão null. */
  tableId: string | null;
  /** Endereço do Vem Trabalhar para o balãozinho. Sem endereço configurado, o balão não aparece. */
  jobsHref?: string | null;
  /** Toque em "Escolher" num prato com tamanho ou extras. A tela das escolhas é a próxima da lista. */
  onChoose?: (product: Product, cart: CartLine[]) => void;
  /** Toque em "Ver sacola". A tela da sacola é a próxima da lista. */
  onBag?: (cart: CartLine[]) => void;
};

type Load = "loading" | "ready" | "error";

/** De quanto em quanto tempo a tela pergunta de novo se o restaurante está aberto, em pausa ou sem pedidos. */
const LIVE_MS = 60000;

/**
 * O cardápio de verdade: busca restaurante, categorias e pratos, mantém a sacola e repete o que o servidor diz
 * (aberto, fechado, em pausa, prato esgotado). Uma busca que falha nunca apaga o cardápio que já está na tela.
 */
export default function ShopScreen({ company, tableId, jobsHref = null, onChoose, onBag }: Props) {
  const [load, setLoad] = useState<Load>("loading");
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [live, setLive] = useState<Company>(company);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [soldOutNote, setSoldOutNote] = useState("");
  const cartRef = useRef(cart);
  cartRef.current = cart;

  useEffect(() => setLive(company), [company]);

  const loadMenu = useCallback(async () => {
    setLoad("loading");
    try {
      const [productList, menuList] = await Promise.all([fetchProducts(company.id), fetchMenus(company.id)]);
      setProducts(Array.isArray(productList) ? productList : []);
      setMenus(Array.isArray(menuList) ? menuList : []);
      setLoad("ready");
    } catch (err) {
      console.error(err);
      setLoad("error");
    }
  }, [company.id]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  // O mesmo cardápio de novo, em silêncio: o prato que acabou sai da sacola e a tela avisa uma vez.
  const refreshMenu = useCallback(async () => {
    try {
      const list = await fetchProducts(company.id);
      if (!Array.isArray(list)) return;
      setProducts(list);
      const { cart: kept, removed } = dropSoldOut(cartRef.current, list);
      if (removed.length > 0) {
        setCart(kept);
        setSoldOutNote(soldOutNotice(removed));
      }
    } catch (err) {
      console.error(err); // mantém o cardápio que está na tela
    }
  }, [company.id]);

  useEffect(() => {
    let stopped = false;
    const refreshCompany = async () => {
      try {
        const fresh = await fetchCompanyBySlug(company.slug);
        if (!stopped && fresh && fresh.id === company.id) setLive(fresh);
      } catch (err) {
        console.error(err); // mantém o que está na tela
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshCompany();
      void refreshMenu();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCompany();
    }, LIVE_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [company.slug, company.id, refreshMenu]);

  useEffect(() => {
    if (!tableId) return;
    let alive = true;
    fetchTable(company.id, tableId)
      .then((table: { number?: number }) => {
        if (!alive) return;
        const number = Number(table?.number);
        setTableNumber(number > 0 ? number : null);
      })
      .catch((err: unknown) => console.error(err));
    return () => {
      alive = false;
    };
  }, [company.id, tableId]);

  const view = useMemo(
    () =>
      shopViewOf({
        company: live,
        fromTable: Boolean(tableId),
        tableNumber,
        products,
        menus,
        cart,
        query,
        media: mediaUrl,
        extraNotices: soldOutNote ? [soldOutNote] : [],
      }),
    [live, tableId, tableNumber, products, menus, cart, query, soldOutNote],
  );

  if (load !== "ready") {
    return (
      <div className="nv-root">
        <main className="nv-screen">
          <TopBar title={company.name} showMenu={false} />
          {load === "loading" ? (
            <p className="nv-empty" role="status">
              Abrindo o cardápio…
            </p>
          ) : (
            <>
              <p className="nv-error" role="alert">
                Não consegui abrir o cardápio. Confira a internet e tente de novo.
              </p>
              <button type="button" className="nv-btn is-green is-block" onClick={() => void loadMenu()}>
                Tentar de novo
              </button>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <ShopMenu
      {...view}
      query={query}
      onQuery={setQuery}
      onAdd={(id) => {
        const product = products.find((entry) => entry.id === id);
        if (product && !view.closed) setCart((current) => addToCart(current, product));
      }}
      onLess={(id) => setCart((current) => decrementItem(current, id))}
      onChoose={(id) => {
        const product = products.find((entry) => entry.id === id);
        if (product && !view.closed) onChoose?.(product, cart);
      }}
      onBag={() => onBag?.(cart)}
      jobsHref={jobsHref}
    />
  );
}
