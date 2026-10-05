import { useEffect, useState } from "react";

type Props = {
  label: string;
  /** Shown for a few seconds after the first tap. */
  confirmLabel?: string;
  onConfirm: () => void;
};

/**
 * Destructive actions need two taps, so a slip of the thumb on a phone cannot
 * delete a dish or a table. After 4 seconds without a second tap it goes back.
 */
export default function ConfirmButton({
  label,
  confirmLabel = "Toque de novo",
  onConfirm,
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
      className={armed ? "btn btn-danger btn-sm is-armed" : "btn btn-danger btn-sm"}
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
