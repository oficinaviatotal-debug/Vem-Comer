import "./novo.css";
import type { ReactNode } from "react";
import { SHELL_OLD_NOTE } from "./copy";
import { TopBar, VoiceOrb } from "./parts";

type Props = {
  title: string;
  /** Quem está dentro ("João, Dono"); vazio some. */
  sub?: string;
  /** O menu do painel. */
  onMenu?: () => void;
  /** A tela antiga, desenhada pelo painel de sempre. */
  children?: ReactNode;
};

/**
 * A moldura das telas que ainda não foram refeitas: o topo novo (com o botão de menu, para ninguém ficar preso numa
 * tela antiga) e, embaixo, a tela antiga funcionando como sempre. A frase avisa que o desenho vai mudar, sem assustar.
 * Cada tela sai desta moldura quando chega a sua rodada.
 */
export default function LegacyFrame({ title, sub, onMenu, children }: Props) {
  return (
    <div className="nv-root nv-legacy">
      <main className="nv-screen nv-page-legacy">
        <TopBar title={title} sub={sub} onMenu={onMenu} showMenu />
        <p className="nv-code-hint nv-legacy-note">{SHELL_OLD_NOTE}</p>
        <div className="adm nv-legacy-body">{children}</div>
      </main>

      {/* A bolinha de voz do painel também nas telas que ainda são as antigas: falar "pedidos" leva ao lugar. */}
      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
