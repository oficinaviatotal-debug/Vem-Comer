/** Reais no jeito de quem fala: "R$ 29,90". */
export function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** "7 min", "1 h 05". Quem lê na cozinha precisa do número, não de uma frase. */
export function minutesText(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** A cor da fita da comanda pelo tempo de espera: verde até 10 min, amarela até 20, vermelha depois. */
export function waitTone(minutes: number): "ok" | "warn" | "late" {
  if (minutes >= 20) return "late";
  if (minutes >= 10) return "warn";
  return "ok";
}
