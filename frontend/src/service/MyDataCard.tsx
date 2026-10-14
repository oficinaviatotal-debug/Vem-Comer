import { useState } from "react";
import "../ui.css";
import "../admin.css";
import "../plan.css";
import "./help.css";
import { downloadMyData } from "./myDataApi";

/**
 * "Seus dados": o dono baixa uma cópia do que guardamos sobre a conta dele, na hora, sem esperar ninguém, e vê
 * onde pedir para corrigir ou apagar. Fica na aba Plano, que continua aberta mesmo com o plano bloqueado.
 */
export default function MyDataCard() {
  const [withOrders, setWithOrders] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function download() {
    setWorking(true);
    setMessage("");
    setFailed(false);
    try {
      await downloadMyData(withOrders);
      setMessage("Pronto: o arquivo foi baixado no seu aparelho.");
    } catch (reason) {
      setFailed(true);
      setMessage(reason instanceof Error ? reason.message : "Não consegui montar a cópia agora.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="plan-history my-data">
      <h3>Seus dados</h3>
      <p className="adm-muted">
        Você pode baixar uma cópia do que o Vem Comer guarda sobre a sua conta. A senha não vai no arquivo.
      </p>
      <label className="check">
        <input type="checkbox" checked={withOrders} onChange={(event) => setWithOrders(event.target.checked)} />
        <span>Incluir os pedidos dos meus clientes (nome, telefone e endereço)</span>
      </label>
      <div className="plan-actions">
        <button type="button" className="btn btn-outline" disabled={working} onClick={() => void download()}>
          {working ? "Montando…" : "Baixar uma cópia dos meus dados"}
        </button>
        <a className="btn btn-quiet" href="/api/privacidade" target="_blank" rel="noreferrer">
          Corrigir, apagar ou outro pedido
        </a>
      </div>
      {message && (
        <p className={failed ? "msg-error" : "adm-muted"} role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}
    </div>
  );
}
