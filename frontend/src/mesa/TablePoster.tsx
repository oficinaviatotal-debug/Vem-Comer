import { useEffect, useState } from "react";
import "../ui.css";
import "./poster.css";
import { renderPoster, printPoster } from "./posterRender.ts";
import { posterFileName, tableLabel } from "./posterLayout.ts";

type Props = {
  restaurant: string;
  tableNumber: string | number;
  /** O QR da mesa (data URL). */
  qr: string;
};

/**
 * "Cartaz para imprimir": o QR da mesa dentro do cartaz "Faça seu pedido aqui" da prancha de modelos.
 * O dono vê o cartaz pronto, baixa a imagem (para mandar à gráfica pelo WhatsApp) ou imprime em folha A4.
 */
export default function TablePoster({ restaurant, tableNumber, qr }: Props) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setImage("");
    setFailed(false);
    renderPoster({ restaurant, tableNumber, qr })
      .then((url) => {
        if (alive) setImage(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open, restaurant, tableNumber, qr]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: { key: string }) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const label = tableLabel(tableNumber);

  return (
    <>
      <button type="button" className="btn btn-primary btn-sm btn-block" onClick={() => setOpen(true)}>
        Cartaz para imprimir
      </button>

      {open && (
        <div className="poster-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="poster-sheet" role="dialog" aria-modal="true" aria-labelledby="poster-title">
            <h2 id="poster-title" className="poster-title">Cartaz da {label}</h2>

            {image ? (
              <img className="poster-img" src={image} alt={`Cartaz da ${label}: faça seu pedido aqui, com o QR code para apontar a câmera`} />
            ) : failed ? (
              <p className="poster-note" role="alert">Não consegui montar o cartaz. Feche e tente de novo.</p>
            ) : (
              <p className="poster-note" role="status">Montando o cartaz…</p>
            )}

            <p className="poster-note">Imprima em folha A4 e cole na mesa. O cliente aponta a câmera e já pede.</p>

            <div className="poster-actions">
              {image ? (
                <>
                  <a className="btn btn-primary btn-block" href={image} download={posterFileName(tableNumber)}>
                    Baixar imagem
                  </a>
                  <button type="button" className="btn btn-outline btn-block" onClick={() => printPoster(image)}>
                    Imprimir
                  </button>
                </>
              ) : null}
              <button type="button" className="btn btn-quiet btn-block" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
