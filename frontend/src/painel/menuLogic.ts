/**
 * O menu geral de quem trabalha no restaurante, versão nova: transforma o que o menu antigo já decidia (quem vê o quê,
 * em que ordem, com que número) nos objetos que a tela nova mostra. Só conta, sem React nem rede:
 * tests/novo/menuLogic.test.mjs roda isto no Node.
 *
 * Nenhuma regra mudou. Quem decide o que cada papel vê continua sendo `nav/navLogic.menuFor` (as regras de sempre das
 * abas: o dono vê tudo, a cozinha só os pedidos, o caixa o acerto, e assim por diante; restaurante bloqueado por falta
 * de pagamento mantém só o que é permitido). O menu mudou o desenho, não quem pode abrir o quê.
 */
import { menuFor, type NavContext } from "../nav/navLogic.ts";
import { roleLabel } from "../service/format.ts";
import type { MenuAction, MenuGroup, MenuView } from "../novo/types.ts";

export type MenuInput = NavContext & {
  /** A tela em que a pessoa está agora ("inicio" é o Hoje). */
  current: string;
  place: string | null | undefined;
  /** Quem está dentro; sem nome (ainda carregando), a linha some. */
  personName: string | null | undefined;
  /** Ajuda: o Guia e o "Preciso de ajuda" só existem para quem pode (como na tela antiga). */
  canHelp?: boolean;
};

/** As ações que não são tela. Quem monta a tela liga cada uma ao que ela faz. */
export const ACTION = { customer: "customer", help: "help", logout: "logout" } as const;

export const PLACE_FALLBACK = "Meu restaurante";

/** A frase do número para o leitor de tela: "3 em aberto". */
export function badgeSpoken(view: string, badge: number): string {
  if (view === "aprovacoes") return `${badge} esperando o seu aval`;
  return `${badge} em aberto`;
}

export function actionsOf(input: Pick<MenuInput, "canHelp">): MenuAction[] {
  return [
    { id: ACTION.customer, label: "Ver o cardápio do cliente", icon: "store" },
    ...(input.canHelp ? [{ id: ACTION.help, label: "Preciso de ajuda", icon: "help" } as MenuAction] : []),
    { id: ACTION.logout, label: "Sair", icon: "logout", quiet: true },
  ];
}

export function menuViewOf(input: MenuInput): MenuView {
  const groups: MenuGroup[] = menuFor(input).map((group) => ({
    key: group.key,
    title: group.title,
    items: group.items.map((item) => ({
      view: item.view,
      label: item.label,
      hint: item.hint,
      icon: item.icon,
      badge: item.badge,
      current: item.view === input.current,
      badgeSpoken: item.badge === null ? "" : badgeSpoken(item.view, item.badge),
    })),
  }));
  const name = (input.personName ?? "").trim();
  return {
    place: (input.place ?? "").trim() || PLACE_FALLBACK,
    person: name ? `${name}, ${roleLabel(input.role)}` : "",
    groups,
    actions: actionsOf(input),
  };
}
