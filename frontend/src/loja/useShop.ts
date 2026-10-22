import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CartLine } from "../customer/cart";
import type { DeliveryInfo } from "../customer/delivery";
import { fetchDeliveryInfo } from "../customer/deliveryApi";
import { dropSoldOut, soldOutNotice } from "../customer/openness";
import type { Company, Menu, Product } from "../customer/types";
import { fetchCompanyBySlug, fetchMenus, fetchPaymentOptions, fetchProducts, fetchTable } from "../service/api";

export type ShopLoad = "loading" | "ready" | "error";

/** Tudo que o cardápio, a sacola e as escolhas repartem: o que o servidor disse e a sacola do cliente. */
export type ShopState = {
  load: ShopLoad;
  products: Product[];
  menus: Menu[];
  /** O restaurante como o servidor disse por último (aberto, fechado, em pausa). */
  live: Company;
  /** Quem entrou pelo QR da mesa: o número da mesa, ou null. */
  tableNumber: number | null;
  /** O QR trouxe uma mesa que o servidor não conhece. */
  tableLost: boolean;
  cart: CartLine[];
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  /** "Pizza acabou e saiu do seu pedido." (dita uma vez); vazio quando não há aviso. */
  soldOutNote: string;
  deliveryInfo: DeliveryInfo | null;
  /** O restaurante cadastrou chave Pix: só então o Pix é oferecido. */
  pixOn: boolean;
  /** Busca o cardápio de novo (o botão "Tentar de novo"). */
  reload: () => void;
};

/** De quanto em quanto tempo a tela pergunta de novo se o restaurante está aberto, em pausa ou sem pedidos. */
const LIVE_MS = 60000;

/**
 * O estado do cardápio de verdade: busca restaurante, categorias, pratos, mesa, entrega e Pix; mantém a sacola e repete
 * o que o servidor diz. Uma busca que falha nunca apaga o cardápio que já está na tela, e o prato que acaba sai da sacola.
 */
export function useShop(company: Company, tableId: string | null): ShopState {
  const [load, setLoad] = useState<ShopLoad>("loading");
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [live, setLive] = useState<Company>(company);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [tableLost, setTableLost] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [soldOutNote, setSoldOutNote] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  const [pixOn, setPixOn] = useState(false);
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
        setTableLost(!(number > 0));
      })
      .catch((err: unknown) => {
        console.error(err);
        if (alive) setTableLost(true);
      });
    return () => {
      alive = false;
    };
  }, [company.id, tableId]);

  // Pix só é oferecido quando o restaurante cadastrou a própria chave. Qualquer falha quer dizer "sem Pix".
  useEffect(() => {
    let alive = true;
    void fetchPaymentOptions(company.id).then((options) => {
      if (alive) setPixOn(options.pix);
    });
    return () => {
      alive = false;
    };
  }, [company.id]);

  // Entrega só existe para pedido fora da mesa; resposta que falha quer dizer "nada a mais para oferecer".
  useEffect(() => {
    if (tableId) return;
    let alive = true;
    void fetchDeliveryInfo(company.id).then((info) => {
      if (alive) setDeliveryInfo(info);
    });
    return () => {
      alive = false;
    };
  }, [company.id, tableId]);

  return {
    load,
    products,
    menus,
    live,
    tableNumber,
    tableLost,
    cart,
    setCart,
    soldOutNote,
    deliveryInfo,
    pixOn,
    reload: () => void loadMenu(),
  };
}
