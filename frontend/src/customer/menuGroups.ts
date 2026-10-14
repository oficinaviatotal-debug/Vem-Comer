/** Turns the flat product list into the sections the customer scrolls through. */

type GroupProduct = {
  id: string;
  menu_id: string | null;
  name: string;
  description?: string | null;
  /** "Tradicionais" inside "Pizzas": a heading between the category and the dishes. Empty when there is none. */
  subcategory?: string | null;
};

type GroupMenu = {
  id: string;
  name: string;
};

export type MenuSection<P extends GroupProduct> = {
  /** Heading shown above the dishes; "" for dishes that have no subsection. */
  title: string;
  items: P[];
};

export type MenuGroup<P extends GroupProduct> = {
  /** Anchor id used by the category chips; "outros" for dishes without a category. */
  key: string;
  title: string;
  items: P[];
  /** The same dishes split by subsection, in the order each subsection first appears. */
  sections: MenuSection<P>[];
};

export const OTHER_KEY = "outros";

/** Splits a category's dishes by subsection. Without any subsection there is one untitled section. */
export function sectionsOf<P extends GroupProduct>(items: P[]): MenuSection<P>[] {
  const sections: MenuSection<P>[] = [];
  const byKey = new Map<string, MenuSection<P>>();
  for (const product of items) {
    const title = (product.subcategory ?? "").trim();
    const mapKey = plain(title);
    let section = byKey.get(mapKey);
    if (!section) {
      section = { title, items: [] };
      byKey.set(mapKey, section);
      sections.push(section);
    }
    section.items.push(product);
  }
  return sections;
}

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

  const make = (key: string, title: string, items: P[]): MenuGroup<P> => ({ key, title, items, sections: sectionsOf(items) });

  const groups: MenuGroup<P>[] = menus.map((menu) =>
    make(menu.id, menu.name, visible.filter((product) => product.menu_id === menu.id))
  );

  const loose = visible.filter((product) => !product.menu_id);
  if (loose.length) {
    groups.push(make(OTHER_KEY, menus.length ? "Outros" : "Cardápio", loose));
  }

  return groups.filter((group) => group.items.length > 0);
}
