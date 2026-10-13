/**
 * Apito e vibração do aparelho: o painel avisa de pedido novo, de mesa chamando e de entrega pronta.
 *
 * `alertPlan` é só a conta (que notas tocar, quando vibrar) e é testada com `node --test`;
 * `alertDevice` é a parte que mexe no aparelho e falha em silêncio: sem som ou sem vibração, a tela avisa do mesmo jeito.
 */

/** "order": pedido novo (duas notas subindo). "call": mesa chamando. "urgent": mesa esperando demais. "ready": entrega pronta para pegar. */
export type AlertKind = "order" | "call" | "urgent" | "ready";

export type Note = { freq: number; at: number; length: number };
export type AlertPlan = { vibrate: number[]; notes: Note[] };

const PLANS: Record<AlertKind, AlertPlan> = {
  order: {
    vibrate: [250, 100, 250],
    notes: [
      { freq: 660, at: 0, length: 0.22 },
      { freq: 880, at: 0.26, length: 0.34 },
    ],
  },
  call: { vibrate: [200, 100, 200], notes: [{ freq: 660, at: 0, length: 0.4 }] },
  urgent: { vibrate: [300, 120, 300, 120, 300], notes: [{ freq: 880, at: 0, length: 0.4 }] },
  ready: {
    vibrate: [200, 80, 200, 80, 200],
    notes: [
      { freq: 740, at: 0, length: 0.18 },
      { freq: 740, at: 0.24, length: 0.18 },
      { freq: 988, at: 0.48, length: 0.3 },
    ],
  },
};

export function alertPlan(kind: AlertKind): AlertPlan {
  return PLANS[kind];
}

/** A conta total do apito, em segundos: o contexto de áudio só pode ser fechado depois dela. */
export function alertDuration(plan: AlertPlan): number {
  return plan.notes.reduce((end, note) => Math.max(end, note.at + note.length), 0);
}

export function alertDevice(kind: AlertKind): void {
  const plan = alertPlan(kind);
  try {
    navigator.vibrate?.(plan.vibrate);
  } catch {
    /* sem vibração neste aparelho */
  }
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    for (const note of plan.notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, start + note.at);
      gain.gain.exponentialRampToValueAtTime(0.25, start + note.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.length);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + note.at);
      osc.stop(start + note.at + note.length + 0.05);
    }
    window.setTimeout(() => void ctx.close(), (alertDuration(plan) + 0.2) * 1000);
  } catch {
    /* o navegador pode bloquear som antes do primeiro toque: tudo bem, a tela avisa do mesmo jeito */
  }
}
