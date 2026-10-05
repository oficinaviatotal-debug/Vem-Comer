/** Turns the flat product list into the sections the customer scrolls through. */

type GroupProduct = {
  id: string;
  menu_id: string | null;
  name: string;
  description?: string | null;
};

type GroupMenu = {
  id: string;
  name: string;
};

export type MenuGroup<P extends GroupProduct> = {
  /** Anchor id used by the category chips; "outros" for dishes without a category. */
  key: string;
  title: string;
  items: P[];
};

export const OTHER_KEY = "outros";

function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "pure" finds "Purê". Matches the name or the description. */
export function matchesSearch(product: GroupProduct, query: string): boolean {
  const needle = plain(query.trim());
  if (!needle) return true;
  return plain(product.name).includes(needle) || plain(product.description ?? "").includes(needle);
}

/**
 * One group per active category, in the order the restaurant created them.
 * Dishes without a category go last under "Outros". Dishes that belong to an
 * inactive category are hidden: the API only sends active categories, so a
 * dish pointing to a missing one belongs to a category the owner turned off.
 * Groups with nothing to show are left out.
 */
export function groupProducts<P extends GroupProduct>(
  products: P[],
  menus: GroupMenu[],
  query = ""
): MenuGroup<P>[] {
  const visible = products.filter((product) => matchesSearch(product, query));

  const groups: MenuGroup<P>[] = menus.map((menu) => ({
    key: menu.id,
    title: menu.name,
    items: visible.filter((product) => product.menu_id === menu.id),
  }));

  const loose = visible.filter((product) => !product.menu_id);
  if (loose.length) {
    groups.push({
      key: OTHER_KEY,
      title: menus.length ? "Outros" : "Cardápio",
      items: loose,
    });
  }

  return groups.filter((group) => group.items.length > 0);
}
