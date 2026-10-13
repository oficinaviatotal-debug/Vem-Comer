import "../ui.css";
import "../admin.css";
import "./courier.css";
import CourierPanel from "./CourierPanel";

type Props = {
  companyId: string;
  name: string;
  onLogout: () => void;
  /** Back to the menu of the restaurant. */
  onBack: () => void;
};

/** What a login whose role is "Entregador" sees: only the deliveries. Nothing else of the restaurant is on this screen. */
export default function CourierHome({ companyId, name, onLogout, onBack }: Props) {
  return (
    <main className="adm crr-page">
      <header className="adm-bar">
        <img className="adm-logo" src="/logo-vem-comer.png" alt="Vem Comer" />

        <div className="adm-bar-actions">
          <button type="button" className="btn btn-quiet btn-sm" onClick={onBack}>
            Cardápio
          </button>
          <button id="courier-btn-logout" type="button" className="btn btn-quiet btn-sm" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <div className="adm-who">
        <h1 className="adm-title">Entregas</h1>
        {name && <p className="adm-lead">{name}, Entregador</p>}
      </div>

      <CourierPanel companyId={companyId} />
    </main>
  );
}
