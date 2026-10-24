import "./novo.css";
import type { ShellNotice } from "./types";

type Props = {
  notices: ShellNotice[];
  /** Toque no botão de um aviso: leva à tela onde o assunto se resolve. */
  onAct?: (id: string) => void;
};

/**
 * Os avisos que acompanham a pessoa em qualquer tela do painel: o plano (vence, bloqueado), o pedido novo e as mesas
 * que chamam. Cada faixa diz o que houve e tem um botão que leva, num toque, ao lugar de resolver. A faixa só informa
 * (lisa, sem relevo); o botão é o que se toca. Sem aviso, não desenha nada.
 */
export default function Notices({ notices, onAct }: Props) {
  if (notices.length === 0) return null;
  return (
    <div className="nv-root nv-notices" role="region" aria-label="Avisos">
      <ul className="nv-notices-list">
        {notices.map((notice) => (
          <li key={notice.id} className={`nv-notice is-${notice.tone}`}>
            {/* O aviso falado pelo leitor de tela é só o texto (o papel vai no parágrafo: na lista, o <li> não pode ter papel próprio). */}
            <p className="nv-notice-text" role={notice.tone === "urgent" ? "alert" : "status"}>
              {notice.text}
            </p>
            <button type="button" className={`nv-btn is-small${notice.tone === "urgent" ? " is-fire" : " is-ghost"}`} onClick={() => onAct?.(notice.id)}>
              {notice.action}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
