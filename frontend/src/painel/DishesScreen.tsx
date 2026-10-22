import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dishes, { type DishesBusy } from "../novo/Dishes";
import {
  DISH_PHOTO_GONE,
  DISH_PHOTO_PREPARING,
  DISH_PHOTO_REMOVE_ERROR,
  DISH_PHOTO_REMOVING,
  DISH_PHOTO_SAVED,
  DISH_PHOTO_SENDING,
  DISHES_ADD_ERROR,
  DISHES_EDIT_ERROR,
  DISHES_EDIT_GONE,
  DISHES_LOAD_ERROR,
  DISHES_REMOVE_ERROR,
  DISHES_RESET_DONE,
  DISHES_RESET_ERROR,
  DISHES_SOLD_ERROR,
} from "../novo/copy";
import { isSoldOut } from "../customer/openness";
import type { Menu, Product } from "../customer/types";
import { deleteProductPhoto, mediaUrl, uploadProductPhoto } from "../service/api";
import { toSendablePhoto } from "../photos/photoFiles";
import { photoErrorText } from "../photos/photoLogic";
import { resetSoldOut, setSoldOut } from "../service/hoursApi";
import { addDish, editDish, loadDishes, removeDish } from "./dishesApi";
import {
  ARM_MS,
  DISHES_POLL_MS,
  allBack,
  dishAddedText,
  dishCheck,
  dishEditCheck,
  dishProblemText,
  dishRemovedText,
  dishSavedText,
  dishesViewOf,
  emptyDishForm,
  formAfterAdd,
  formOfDish,
  withEdit,
  withPhoto,
  withSoldOut,
  wordsOf,
} from "./dishesLogic";
import type { DishForm, DishPhotoView } from "../novo/types";

type Props = {
  companyId: string;
  /** Dono e gerente criam e removem; a cozinha só marca o que esgotou. O servidor confere de novo. */
  canManage: boolean;
  /** Leva ao montar o cardápio por foto, arquivo ou voz. Sem ele o botão não aparece. */
  onMake?: () => void;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

/**
 * Pratos de verdade. Esgotou e Voltou valem na hora na tela e voltam atrás se o servidor recusar. A lista pergunta de novo
 * a cada 30 s com a tela à vista (para ver o que outro aparelho marcou), mas nunca por cima de um toque que ainda não
 * chegou ao servidor. Remover pede dois toques na lixeira; criar confere nome, preço e repetição antes de mandar.
 */
export default function DishesScreen({ companyId, canManage, onMake, onMenu }: Props) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<DishForm | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [adding, setAdding] = useState(false);
  /** A foto do prato que o lápis está mostrando: o que está acontecendo com ela agora (ou null). */
  const [photoState, setPhotoState] = useState<{ id: string; phase: DishPhotoView["phase"]; message: string } | null>(null);
  /** Cada foto tem o seu número: se o lápis fechar ou mudar de prato, a resposta que chega tarde não escreve na tela. */
  const photoJob = useRef(0);
  const [notice, setNotice] = useState("");
  /** O que deu errado numa ação (esgotou, remover, adicionar) fica na tela até o próximo toque; a busca da lista não o apaga. */
  const [error, setError] = useState("");
  /** A lista não veio. Some quando uma busca der certo. */
  const [listError, setListError] = useState("");
  const alive = useRef(true);
  /** Remover, voltar tudo e adicionar não andam juntos: um por vez. */
  const working = useRef(false);
  /** Quantos esgotou/voltou ainda não chegaram ao servidor, e quantas mudanças a tela já fez (para descartar busca velha). */
  const pending = useRef(0);
  const changes = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    const before = changes.current;
    try {
      const next = await loadDishes(companyId);
      if (!alive.current) return;
      // A resposta saiu antes de um toque que a tela já fez (ou ainda não chegou ao servidor): ela está velha, esta rodada não vale.
      if (pending.current > 0 || changes.current !== before) return;
      setProducts(next.products);
      setMenus(next.menus);
      setListError("");
    } catch {
      if (alive.current) setListError(DISHES_LOAD_ERROR);
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

  // Fechar o lápis ou abrir o de outro prato: a frase da foto de antes não vale mais.
  useEffect(() => {
    photoJob.current += 1;
    setPhotoState(null);
  }, [form?.editId]);

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(null);
  }, []);

  const focusLater = useCallback((id: string) => {
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  }, []);

  const view = useMemo(
    () => dishesViewOf({ products, menus, canManage, query, armed, media: mediaUrl, error: error || listError, notice, editing: form?.editId ?? null }),
    [products, menus, canManage, query, armed, error, listError, notice, form?.editId],
  );
  const busy: DishesBusy = { toggling, removing, resetting, adding };

  const toggle = async (id: string) => {
    if (!products || working.current || toggling.includes(id)) return;
    const dish = products.find((product) => product.id === id);
    if (!dish) return;
    const wanted = !isSoldOut(dish);
    setNotice("");
    setError("");
    disarm();
    // Na hora, na tela; se o servidor recusar, volta atrás.
    changes.current += 1;
    pending.current += 1;
    setProducts((list) => (list ? withSoldOut(list, id, wanted) : list));
    setToggling((current) => [...current, id]);
    try {
      const confirmed = await setSoldOut(id, wanted);
      if (!alive.current) return;
      changes.current += 1;
      setProducts((list) => (list ? withSoldOut(list, id, confirmed) : list));
    } catch (failure) {
      if (!alive.current) return;
      changes.current += 1;
      setProducts((list) => (list ? withSoldOut(list, id, !wanted) : list));
      setError(wordsOf(failure, DISHES_SOLD_ERROR));
    } finally {
      pending.current -= 1;
      if (alive.current) setToggling((current) => current.filter((entry) => entry !== id));
    }
  };

  const reset = async () => {
    if (working.current || !products) return;
    working.current = true;
    setResetting(true);
    setNotice("");
    setError("");
    disarm();
    try {
      await resetSoldOut();
      if (!alive.current) return;
      changes.current += 1;
      setProducts((list) => (list ? allBack(list) : list));
      setNotice(DISHES_RESET_DONE);
    } catch (failure) {
      if (alive.current) setError(wordsOf(failure, DISHES_RESET_ERROR));
    } finally {
      working.current = false;
      if (alive.current) setResetting(false);
      focusLater("nv-dishes-live");
    }
  };

  const remove = async (id: string) => {
    if (working.current || !products) return;
    if (armed !== id) {
      // Primeiro toque: guarda este prato e espera o segundo por alguns segundos. Ninguém apaga um prato com um toque só.
      window.clearTimeout(timer.current);
      setArmed(id);
      timer.current = window.setTimeout(() => setArmed(null), ARM_MS);
      return;
    }
    disarm();
    const dish = products.find((product) => product.id === id);
    if (!dish) return;
    working.current = true;
    setRemoving(id);
    setNotice("");
    setError("");
    try {
      await removeDish(id);
      if (!alive.current) return;
      changes.current += 1;
      setProducts((list) => (list ? list.filter((product) => product.id !== id) : list));
      setNotice(dishRemovedText(dish.name));
    } catch (failure) {
      if (alive.current) setError(wordsOf(failure, DISHES_REMOVE_ERROR));
    } finally {
      working.current = false;
      if (alive.current) setRemoving(null);
      focusLater("nv-dishes-live");
    }
  };

  const add = async () => {
    if (working.current || !form || !products || !menus) return;
    const check = dishCheck(form, products, menus);
    if (!check.ok) {
      setForm({ ...form, problem: check.problem });
      focusLater(check.problem === "price" ? "nv-dish-price" : "nv-dish-name");
      return;
    }
    working.current = true;
    setAdding(true);
    setNotice("");
    setError("");
    try {
      await addDish(companyId, check.dish);
      if (!alive.current) return;
      changes.current += 1;
      setNotice(dishAddedText(check.dish.name));
      // O formulário fica aberto e guarda a categoria: quem cadastra bebidas cadastra várias seguidas.
      setForm((current) => (current ? formAfterAdd(current) : current));
      focusLater("nv-dish-name");
    } catch (failure) {
      if (alive.current) setError(wordsOf(failure, DISHES_ADD_ERROR));
    } finally {
      working.current = false;
      if (alive.current) setAdding(false);
      // Entrou ou não, olha a lista de novo: é nela que se vê se o prato já está lá.
      void load();
    }
  };

  /** Tirar a foto na hora ou escolher uma do celular: prepara, manda e só diz "Foto salva." quando o servidor respondeu que salvou. */
  const sendPhoto = async (file: File) => {
    const id = form?.editId;
    if (!id || photoState?.phase === "working") return;
    const mine = ++photoJob.current;
    const stillHere = () => alive.current && mine === photoJob.current;
    setPhotoState({ id, phase: "working", message: DISH_PHOTO_PREPARING });
    try {
      const blob = await toSendablePhoto(file);
      if (stillHere()) setPhotoState({ id, phase: "working", message: DISH_PHOTO_SENDING });
      const result = await uploadProductPhoto(id, blob);
      if (alive.current) {
        changes.current += 1;
        setProducts((list) => (list ? withPhoto(list, id, result.thumb_url, result.image_url) : list));
      }
      if (stillHere()) setPhotoState({ id, phase: "done", message: DISH_PHOTO_SAVED });
    } catch (failure) {
      if (stillHere()) setPhotoState({ id, phase: "error", message: photoErrorText(failure) });
    } finally {
      if (alive.current) void load();
    }
  };

  /** Tirar a foto do prato. Se o servidor não confirmar, a foto continua na tela e a frase diz que não deu. */
  const dropPhoto = async () => {
    const id = form?.editId;
    if (!id || photoState?.phase === "working") return;
    const mine = ++photoJob.current;
    const stillHere = () => alive.current && mine === photoJob.current;
    setPhotoState({ id, phase: "working", message: DISH_PHOTO_REMOVING });
    try {
      await deleteProductPhoto(id);
      if (alive.current) {
        changes.current += 1;
        setProducts((list) => (list ? withPhoto(list, id, null, null) : list));
      }
      if (stillHere()) setPhotoState({ id, phase: "done", message: DISH_PHOTO_GONE });
    } catch {
      if (stillHere()) setPhotoState({ id, phase: "error", message: DISH_PHOTO_REMOVE_ERROR });
    } finally {
      if (alive.current) void load();
    }
  };

  /** O lápis: abre o formulário de cima já preenchido com o que o prato tem agora. Um formulário por vez. */
  const edit = (id: string) => {
    if (working.current || !products || !menus) return;
    const product = products.find((entry) => entry.id === id);
    if (!product) return;
    disarm();
    setNotice("");
    setError("");
    setForm(formOfDish(product, menus));
  };

  /** Salvar. Só vai ao servidor o que a pessoa mexeu; sem nada mexido, só fecha. */
  const save = async () => {
    if (working.current || !form?.editId || !products || !menus) return;
    const product = products.find((entry) => entry.id === form.editId);
    if (!product) {
      // Outro aparelho removeu o prato enquanto este formulário estava aberto.
      setForm(null);
      setError(DISHES_EDIT_GONE);
      return;
    }
    const check = dishEditCheck(form, product, products, menus);
    if (!check.ok) {
      setForm({ ...form, problem: check.problem });
      focusLater(check.problem === "price" ? "nv-dish-price" : "nv-dish-name");
      return;
    }
    const back = `nv-dish-edit-${product.id}`;
    if (Object.keys(check.patch).length === 0) {
      setForm(null);
      focusLater(back);
      return;
    }
    working.current = true;
    setAdding(true);
    setNotice("");
    setError("");
    try {
      await editDish(product.id, check.patch);
      if (!alive.current) return;
      changes.current += 1;
      setProducts((list) => (list ? withEdit(list, product.id, check.patch) : list));
      setNotice(dishSavedText(check.patch.name ?? product.name));
      setForm(null);
      focusLater(back);
    } catch (failure) {
      if (alive.current) setError(wordsOf(failure, DISHES_EDIT_ERROR));
    } finally {
      working.current = false;
      if (alive.current) setAdding(false);
      // Mudou ou não, olha a lista de novo: é nela que se vê se o prato já está como a pessoa pediu.
      void load();
    }
  };

  const editing = form?.editId ? products?.find((entry) => entry.id === form.editId) : undefined;
  const photoView: DishPhotoView | null = editing
    ? {
        src: mediaUrl(editing.thumb_url),
        phase: photoState?.id === editing.id ? photoState.phase : "idle",
        message: photoState?.id === editing.id ? photoState.message : "",
      }
    : null;

  return (
    <Dishes
      view={view}
      query={query}
      form={form}
      photo={photoView}
      onPhoto={(file) => void sendPhoto(file)}
      onPhotoRemove={() => void dropPhoto()}
      problemText={form ? dishProblemText(form.problem) : ""}
      busy={busy}
      onQuery={setQuery}
      onToggle={(id) => void toggle(id)}
      onRemove={(id) => void remove(id)}
      onReset={() => void reset()}
      onOpenForm={() => {
        setNotice("");
        setForm(emptyDishForm());
      }}
      onEdit={edit}
      onForm={(patch) => setForm((current) => (current ? { ...current, ...patch, problem: "" } : current))}
      onAdd={() => void (form?.editId ? save() : add())}
      onCloseForm={() => {
        const back = form?.editId ? `nv-dish-edit-${form.editId}` : "nv-dishes-new";
        setForm(null);
        focusLater(back);
      }}
      onMake={onMake}
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
