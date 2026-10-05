/**
 * Remembers, in this browser only, which restaurant the owner last signed in
 * to. Opening the bare address (for example from the home-screen icon) then
 * goes straight back to that restaurant's panel instead of an error.
 */

const KEY = "vc_last_company";

export function rememberCompany(slug: string) {
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {
    /* storage unavailable: the owner just opens the full link next time */
  }
}

export function lastCompany(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
