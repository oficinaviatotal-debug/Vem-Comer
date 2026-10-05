/**
 * Links the app builds for people to open. They are built from the origin and
 * path only, so nothing else in the current address (for example the owner's
 * ?painel=1) can leak into a link that customers scan.
 */

/** Link printed in the QR code of a table. Customers open it, so it never opens the panel. */
export function tableOrderUrl(
  origin: string,
  pathname: string,
  slug: string,
  tableId: string
): string {
  const url = new URL(pathname || "/", origin);
  url.searchParams.set("empresa", slug);
  url.searchParams.set("mesa", tableId);
  return url.toString();
}

/** Link the restaurant owner opens to reach the panel. */
export function panelUrl(origin: string, pathname: string, slug: string): string {
  const url = new URL(pathname || "/", origin);
  url.searchParams.set("empresa", slug);
  url.searchParams.set("painel", "1");
  return url.toString();
}

/** True when the address asks for the owner panel. */
export function wantsPanel(search: string): boolean {
  return new URLSearchParams(search).get("painel") === "1";
}
