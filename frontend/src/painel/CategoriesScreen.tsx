import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Categories, { type CategoriesBusy } from "../novo/Categories";
import { CATS_ADD_ERROR, CATS_LOAD_ERROR, CATS_REMOVE_ERROR } from "../novo/copy";
import type { Menu, Product } from "../customer/types";
import { addCategory, loadDishes, removeCategory } from "./dishesApi";
import { ARM_MS, DISHES_POLL_MS, categoriesViewOf, categoryAddedText, categoryCheck, categoryProblemText, categoryRemovedText, wordsOf } from "./dishesLogic";

type Props = {
  companyId: string;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

/**
 * Categorias de verdade. Criar leva um nome (limpo e com inicial maiúscula; vazio e repetido não vão ao servidor). Remover pede dois
 * toques na lixeira e diz quantos pratos a categoria tem; os pratos não somem, ficam sem categoria. Só dono e gerente chegam aqui.
 */
export default function CategoriesScreen({ companyId, onMenu }: Props) {
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<"" | "name" | "twice">("");
  const [armed, setArmed] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  /** O que deu errado numa ação (adicionar, remover) fica na tela até o próximo toque; a busca da lista não o apaga. */
  const [error, setError] = useState("");
  /** A lista não veio. Some quando uma busca der certo. */
  const [listError, setListError] = useState("");
  const alive = useRef(true);
  const working = useRef(false);
  const changes = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    const before = changes.current;
    try {
      const next = await loadDishes(companyId);
      if (!alive.current || changes.current !== before) return;
      setMenus(next.menus);
      setProducts(next.products);
      setListError("");
    } catch {
      if (alive.current) setListError(CATS_LOAD_ERROR);
    }
  }, [companyId]);

  useEffect(() => {
    alive.current = true;
    void load();
    const poll = window.setInterval(() => {
      if (!document.hidden) void load();
    }, DISHES_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(poll);
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(null);
  }, []);

  const view = useMemo(() => categoriesViewOf({ menus, products, armed, error: error || listError, notice }), [menus, products, armed, error, listError, notice]);
  const busy: CategoriesBusy = { adding, removing };

  const add = async () => {
    if (working.current || !menus) return;
    const check = categoryCheck(name, menus);
    if (!check.ok) {
      setProblem(check.problem);
      return;
    }
    working.current = true;
    setAdding(true);
    setNotice("");
    setError("");
    try {
      await addCategory(companyId, check.name);
      if (!alive.current) return;
      changes.current += 1;
      setName("");
      setNotice(categoryAddedText(check.name));
    } catch (failure) {
      if (alive.current) setError(wordsOf(failure, CATS_ADD_ERROR));
    } finally {
      working.current = false;
      if (alive.current) setAdding(false);
      // Entrou ou não, olha a lista de novo: é nela que se vê se a categoria já está lá.
      void load();
      window.requestAnimationFrame(() => document.getElementById("nv-cat-name")?.focus());
    }
  };

  const remove = async (id: string) => {
    if (working.current || !menus) return;
    if (armed !== id) {
      window.clearTimeout(timer.current);
      setArmed(id);
      timer.current = window.setTimeout(() => setArmed(null), ARM_MS);
      return;
    }
    disarm();
    const category = menus.find((menu) => menu.id === id);
    if (!category) return;
    working.current = true;
    setRemoving(id);
    setNotice("");
    setError("");
    try {
      await removeCategory(id);
      if (!alive.current) return;
      changes.current += 1;
      setMenus((list) => (list ? list.filter((menu) => menu.id !== id) : list));
      setNotice(categoryRemovedText(category.name));
    } catch (failure) {
      if (alive.current) setError(wordsOf(failure, CATS_REMOVE_ERROR));
    } finally {
      working.current = false;
      if (alive.current) setRemoving(null);
      void load();
      window.requestAnimationFrame(() => document.getElementById("nv-cats-live")?.focus());
    }
  };

  return (
    <Categories
      view={view}
      name={name}
      problemText={categoryProblemText(problem)}
      busy={busy}
      onName={(text) => {
        setName(text);
        setProblem("");
      }}
      onAdd={() => void add()}
      onRemove={(id) => void remove(id)}
      onRefresh={() => {
        setNotice("");
        setError("");
        disarm();
        void load();
      }}
      onMenu={onMenu}
    />
  );
}
