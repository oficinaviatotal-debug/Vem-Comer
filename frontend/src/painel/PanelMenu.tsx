import MainMenu from "../novo/MainMenu";
import { useSheetBehavior } from "../loja/useSheetBehavior";
import { ACTION, menuViewOf, type MenuInput } from "./menuLogic";

type Props = MenuInput & {
  /** Toque numa tela do menu. O menu fecha sozinho depois. */
  onSelect: (view: string) => void;
  onClose: () => void;
  /** Cada ação que não é tela. Sem a função, a ação não aparece (ajuda) ou não faz nada. */
  onCustomer: () => void;
  onHelp?: () => void;
  onLogout: () => void;
};

/**
 * O menu geral de verdade: monta o que cada pessoa vê pelas regras de sempre (`menuLogic`, que usa `nav/navLogic`) e cuida
 * do que um menu aberto precisa: a tela de trás não rola, o Esc fecha, o foco entra no menu e volta para o botão que o
 * abriu, e o Tab não sai dele. Quem desenha é `novo/MainMenu.tsx`. Ainda não está ligado ao painel público.
 */
export default function PanelMenu({ onSelect, onClose, onCustomer, onHelp, onLogout, ...input }: Props) {
  useSheetBehavior(onClose, { root: ".nv-drawer", focusId: "nv-menu-title" });
  const menu = menuViewOf({ ...input, canHelp: Boolean(input.canHelp && onHelp) });

  return (
    <MainMenu
      menu={menu}
      onSelect={(view) => {
        onSelect(view);
        onClose();
      }}
      onAction={(id) => {
        onClose();
        if (id === ACTION.customer) onCustomer();
        else if (id === ACTION.help) onHelp?.();
        else if (id === ACTION.logout) onLogout();
      }}
      onClose={onClose}
    />
  );
}
