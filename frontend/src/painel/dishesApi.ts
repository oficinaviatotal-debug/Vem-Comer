import { API_URL, HttpError, expireSession, fetchMenus, fetchProducts, getToken } from "../service/api";
import type { Menu, Product } from "../customer/types";
import { DISHES_EDIT_MISSING } from "../novo/copy";
import type { DishPatch, DishToSend } from "./dishesLogic";

/** Pratos e categorias do painel, falando com o servidor. A parte de contas e textos está em `dishesLogic.ts` (testada no Node). */

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** O erro do servidor com a frase dele; login vencido leva o painel de volta ao login, em vez de um erro que nunca some. */
async function failure(response: Response, fallback: string): Promise<HttpError> {
  if (response.status === 401) expireSession();
  const body = await response.json().catch(() => ({}));
  const words = typeof body?.error === "string" && body.error ? body.error : fallback;
  return new HttpError(words, response.status);
}

/** Os pratos e as categorias do restaurante, as mesmas listas que o cliente vê (mais os esgotados, marcados). */
export async function loadDishes(companyId: string): Promise<{ products: Product[]; menus: Menu[] }> {
  const [products, menus] = await Promise.all([fetchProducts(companyId), fetchMenus(companyId)]);
  return {
    products: Array.isArray(products) ? (products as Product[]) : [],
    menus: Array.isArray(menus) ? (menus as Menu[]) : [],
  };
}

/** Cria um prato. Só dono e gerente; o servidor confere nome, preço e categoria de novo. */
export async function addDish(companyId: string, dish: DishToSend): Promise<void> {
  const response = await fetch(`${API_URL}/companies/${encodeURIComponent(companyId)}/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name: dish.name, description: dish.description, price: dish.price, menu_id: dish.menuId }),
  });
  if (!response.ok) throw await failure(response, "Não consegui adicionar o prato.");
}

/**
 * Muda um prato: só os campos que vêm em `patch` (os outros ficam como estão no servidor). Só dono e gerente.
 * Um servidor sem a rota responde 405 (a rota existe só para apagar); aí a frase diz que falta atualizá-lo.
 */
export async function editDish(productId: string, patch: DishPatch): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.price !== undefined) body.price = patch.price;
  if (patch.menuId !== undefined) body.menu_id = patch.menuId;
  const response = await fetch(`${API_URL}/admin/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (response.status === 405) throw new HttpError(DISHES_EDIT_MISSING, 405);
  if (!response.ok) throw await failure(response, "Não consegui mudar o prato.");
}

/** Remove um prato. Só dono e gerente. Prato que já foi pedido o servidor recusa (409) e diz para usar Esgotou. */
export async function removeDish(productId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw await failure(response, "Não consegui remover o prato.");
}

/** Cria uma categoria. Só dono e gerente. */
export async function addCategory(companyId: string, name: string): Promise<void> {
  const response = await fetch(`${API_URL}/companies/${encodeURIComponent(companyId)}/admin/menus`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw await failure(response, "Não consegui adicionar a categoria.");
}

/** Remove uma categoria; os pratos dela ficam sem categoria (o banco faz isso). Só dono e gerente. */
export async function removeCategory(menuId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/menus/${encodeURIComponent(menuId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw await failure(response, "Não consegui remover a categoria.");
}
