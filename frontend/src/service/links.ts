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

/** The first screens an owner can ask for from the bare address (no restaurant chosen yet). */
export type EntryScreen = "signup" | "login" | "terms";

function entryUrl(origin: string, pathname: string, name: string): string {
  const url = new URL(pathname || "/", origin);
  url.searchParams.set(name, "1");
  return url.toString();
}

/** Page where a restaurant owner signs up by himself. */
export function signupUrl(origin: string, pathname: string): string {
  return entryUrl(origin, pathname, "cadastro");
}

/** Page where a returning owner signs in without knowing the restaurant link. */
export function ownerLoginUrl(origin: string, pathname: string): string {
  return entryUrl(origin, pathname, "entrar");
}

/** Page with the terms of use and the privacy notice. */
export function termsUrl(origin: string, pathname: string): string {
  return entryUrl(origin, pathname, "termos");
}

/** Which entry screen the address asks for, if any. Terms win, so a sign-up page can link to them. */
export function entryScreen(search: string): EntryScreen | null {
  const params = new URLSearchParams(search);
  if (params.get("termos") === "1") return "terms";
  if (params.get("cadastro") === "1") return "signup";
  if (params.get("entrar") === "1") return "login";
  return null;
}
