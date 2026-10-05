/**
 * Copies text with the modern clipboard API and, when the phone refuses, with
 * the old select-and-copy of a text field. Returns false when neither worked,
 * so the screen can tell the person to press and hold the text instead.
 */
export async function copyText(text: string, field: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the manual way.
  }
  try {
    if (field) {
      field.focus();
      field.select();
      field.setSelectionRange(0, text.length);
      return document.execCommand("copy");
    }
  } catch {
    // The person can still press and hold the text.
  }
  return false;
}
