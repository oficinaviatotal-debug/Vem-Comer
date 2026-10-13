import { useEffect, useState } from "react";

type Props = {
  label: string;
  /** Shown for a few seconds after the first tap. */
  confirmLabel?: string;
  onConfirm: () => void;
  /** "danger" (red, the default) for what deletes; "ok" (green) for what cannot be undone but is not a loss. */
  tone?: "danger" | "ok";
};

/**
 * Destructive actions need two taps, so a slip of the thumb on a phone cannot
 * delete a dish or a table. After 4 seconds without a second tap it goes back.
 */
export default function ConfirmButton({
  label,
  confirmLabel = "Toque de novo",
  onConfirm,
  tone = "danger",
}: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className={`btn ${tone === "ok" ? "btn-mata" : "btn-danger"} btn-sm${armed ? " is-armed" : ""}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
