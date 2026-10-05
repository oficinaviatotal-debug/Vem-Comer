type Props = {
  /** Dish name, only used so screen readers say what the buttons change. */
  label: string;
  quantity: number;
  onMore: () => void;
  onLess: () => void;
};

/** "− 2 +" control used in the menu and in the order slip. */
export default function QuantityStepper({ label, quantity, onMore, onLess }: Props) {
  return (
    <div className="cust-step" role="group" aria-label={`Quantidade de ${label}`}>
      <button type="button" onClick={onLess} aria-label={`Tirar um ${label}`}>
        −
      </button>
      <output aria-live="polite">{quantity}</output>
      <button type="button" onClick={onMore} aria-label={`Mais um ${label}`}>
        +
      </button>
    </div>
  );
}
