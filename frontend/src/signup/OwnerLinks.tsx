import { useEffect, useState } from "react";
import "../ui.css";
import "./signup.css";
import { fetchSignupStatus } from "../service/api";
import { ownerLoginUrl, signupUrl } from "../service/links";

/**
 * Atalhos do dono na tela inicial (o endereço sem restaurante). "Entrar" sempre aparece;
 * "Cadastrar meu restaurante" só aparece quando o cadastro pela internet está aberto.
 */
export default function OwnerLinks() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSignupStatus().then((status) => {
      if (alive) setOpen(status === "open");
    });
    return () => {
      alive = false;
    };
  }, []);

  const { origin, pathname } = window.location;

  return (
    <div className="home-owner">
      <p className="adm-lead">Dono de restaurante?</p>
      {open && (
        <a className="btn btn-primary btn-block" href={signupUrl(origin, pathname)}>
          Cadastrar meu restaurante
        </a>
      )}
      {/* sempre do mesmo estilo: quando o status chega e o botão de cadastro aparece, "Entrar" não pisca nem muda de cor */}
      <a className="btn btn-outline btn-block" href={ownerLoginUrl(origin, pathname)}>
        Entrar
      </a>
    </div>
  );
}
