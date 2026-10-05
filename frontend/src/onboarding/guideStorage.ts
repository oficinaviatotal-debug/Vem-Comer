/**
 * Remembers, in this browser only, whether the guide was already shown and
 * whether the user wants it to talk. Storage can be blocked (private mode,
 * strict settings), so every access is wrapped and falls back safely.
 */

const PREFIX = "vc_guide_";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage unavailable: the guide simply may show again next time */
  }
}

const seenKey = (tourId: string, userId: string) => `seen_${tourId}_${userId}`;

export function hasSeenGuide(tourId: string, userId: string): boolean {
  return read(seenKey(tourId, userId)) === "1";
}

export function markGuideSeen(tourId: string, userId: string) {
  write(seenKey(tourId, userId), "1");
}

/** Voice is on unless the user turned it off. */
export function isGuideVoiceEnabled(): boolean {
  return read("voice") !== "off";
}

export function setGuideVoiceEnabled(enabled: boolean) {
  write("voice", enabled ? "on" : "off");
}
