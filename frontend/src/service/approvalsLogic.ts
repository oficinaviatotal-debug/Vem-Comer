/**
 * The words and rules of the "Aprovações" screen (only for the owner of the platform): what each decision means, what
 * the card says, how the registry reads. No imports, so it runs in the Node tests as it is.
 *
 * Approving only releases an action and writes the go-ahead in the registry. The server decides who may decide,
 * and decides once: sending the same answer again is not an error, changing the mind afterwards is refused.
 */

export type Evidence = { fact: string; source: string; date: string };

export type ApprovalCard = {
  id: string;
  agent: string;
  agent_label: string;
  kind: string;
  level: number;
  level_label: string;
  title: string;
  what: string;
  why: string;
  risk: string;
  if_refused: string;
  evidence: Evidence[];
  status: string;
  status_label: string;
  when_label: string;
  decision_note: string;
  result: string;
  cost_cents: number;
};

export type ApprovalsData = {
  pending: ApprovalCard[];
  pending_count: number;
  recent: ApprovalCard[];
};

export type Decision = "approve" | "refuse" | "change";

export type DecisionChoice = {
  key: Decision;
  label: string;
  /** The button that really sends it, after the owner picked and (maybe) wrote a note. */
  confirm: string;
  /** What this answer does, in one line. Never promises more than the server does. */
  hint: string;
  needsNote: boolean;
};

export const NOTE_MAX = 500;
export const CHANGE_NOTE_MIN = 3;

export const DECISIONS: DecisionChoice[] = [
  { key: "approve", label: "Aprovar", confirm: "Confirmar: aprovar", hint: "Aprovar só libera a ação e fica no registro.", needsNote: false },
  { key: "refuse", label: "Recusar", confirm: "Confirmar: recusar", hint: "A ação não acontece. A recusa fica no registro.", needsNote: false },
  { key: "change", label: "Pedir mudança", confirm: "Confirmar: pedir mudança", hint: "Diga o que deve mudar. O pedido fica no registro.", needsNote: true },
];

export function decisionOf(key: string | null): DecisionChoice | undefined {
  return DECISIONS.find((item) => item.key === key);
}

/** What is wrong with the note, or an empty string when it is fine to send. The server checks it again. */
export function noteProblem(decision: Decision, note: string): string {
  const text = note.trim();
  if (text.length > NOTE_MAX) return `A nota passa de ${NOTE_MAX} letras.`;
  if (decision === "change" && text.length < CHANGE_NOTE_MIN) return "Diga o que deve mudar.";
  return "";
}

/** The line on top of the queue. */
export function queueHeadline(count: number): string {
  if (count <= 0) return "Nada espera o seu aval";
  if (count === 1) return "1 decisão espera o seu aval";
  return `${count} decisões esperam o seu aval`;
}

export const QUEUE_EMPTY =
  "Ainda não há agentes trabalhando. Quando um agente preparar algo que precisa do seu aval, o cartão aparece aqui.";

export const LOG_EMPTY = "O registro ainda está vazio.";

export type StatusTone = "wait" | "go" | "ok" | "stop" | "ask";

/** The colour family of a status chip. The chip always carries the written status as well. */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case "pendente":
      return "wait";
    case "aprovada":
      return "go";
    case "feita":
      return "ok";
    case "mudanca":
      return "ask";
    default:
      return "stop"; // recusada, falhou and anything the screen does not know
  }
}

/** "R$ 0,90"; zero is said in words, never as a made-up price. */
export function costText(cents: number): string {
  const value = Math.trunc(Number(cents));
  if (!Number.isFinite(value) || value <= 0) return "Sem custo";
  const whole = String(Math.floor(value / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${whole},${String(value % 100).padStart(2, "0")}`;
}

/** "2026-10-15" -> "15/10/2026". Anything else is shown as it came. */
export function dateBr(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(iso ?? "");
}

/** The source line under a fact: every fact on a card says where it came from and when. */
export function evidenceSource(item: Evidence): string {
  const source = String(item.source ?? "").trim();
  const when = dateBr(item.date);
  return source && when ? `Fonte: ${source}, ${when}` : source ? `Fonte: ${source}` : "Sem fonte";
}

/** What the owner reads right after deciding. */
export function doneText(status: string, already: boolean): string {
  switch (status) {
    case "aprovada":
      return already ? "Já estava aprovada." : "Aprovada. Aprovar só libera: nada foi executado.";
    case "recusada":
      return already ? "Já estava recusada." : "Recusada. Fica no registro.";
    case "mudanca":
      return already ? "O pedido de mudança já estava registrado." : "Pedido de mudança registrado.";
    default:
      return "Pronto.";
  }
}

/** The small number on the menu item: nothing when there is nothing to do or when it is not known. */
export function approvalsBadge(count: number | null | undefined): number | null {
  return typeof count === "number" && count > 0 ? count : null;
}
