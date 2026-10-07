/**
 * Which voice fits this phone and this connection.
 *
 * - "leve" (2G, "economia de dados", offline): only the voice stored in the phone. Nothing is
 *   downloaded to speak; a network voice would make the guide wait seconds before every sentence.
 * - "media" (3G): the natural voice of the server when it is turned on, with more time to arrive;
 *   otherwise the phone's voice, preferring the more natural ones the browser streams.
 * - "plena" (4G, 5G, Wi-Fi, or a computer that does not say): the natural voice of the server when
 *   it is turned on, with the phone's voice as the fallback whenever the server is slow or fails.
 *
 * The browser tells the connection through navigator.connection (Chrome on Android does; Safari and
 * Firefox do not). When it does not tell, "plena" is assumed, and the time budget
 * keeps a slow connection from making the guide wait (assistant/voiceIO.ts).
 */

export type VoiceTier = "leve" | "media" | "plena";

/** What navigator.connection reports (Network Information API); every field is optional. */
export type ConnectionInfo = {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
};

/** Below this many megabits per second a download of a sentence (10 to 30 KB) starts to be felt. */
const SLOW_DOWNLINK_MBPS = 0.7;

export function voiceTier(connection?: ConnectionInfo | null, online = true): VoiceTier {
  if (!online) return "leve";
  if (!connection) return "plena";
  if (connection.saveData) return "leve";
  const type = (connection.effectiveType ?? "").toLowerCase();
  if (type === "slow-2g" || type === "2g") return "leve";
  if (type === "3g") return "media";
  if (typeof connection.downlink === "number" && connection.downlink > 0 && connection.downlink < SLOW_DOWNLINK_MBPS) {
    return "media";
  }
  return "plena";
}

/** The tier of this browser right now. */
export function currentVoiceTier(): VoiceTier {
  if (typeof navigator === "undefined") return "plena";
  const holder = navigator as Navigator & { connection?: ConnectionInfo };
  const online = typeof navigator.onLine === "boolean" ? navigator.onLine : true;
  return voiceTier(holder.connection ?? null, online);
}

/**
 * Whether to ask the server for the natural voice. On 2G never: a sentence would arrive seconds late.
 * On 3G yes, with a longer wait; the audio of a sentence is small (about 4 KB per second of speech).
 */
export function usesNaturalVoice(tier: VoiceTier, serverHasIt: boolean): boolean {
  return serverHasIt && tier !== "leve";
}

/**
 * How long the natural voice may take to start before the phone's voice speaks instead, in milliseconds.
 * A sentence the server has never said takes longer the first time; it keeps it, so the next time is quick.
 */
export function serverVoiceBudgetMs(tier: VoiceTier): number {
  if (tier === "plena") return 2000;
  if (tier === "media") return 2800;
  return 0;
}
