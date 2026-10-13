/**
 * Pedido novo no painel: quais números de pedido apareceram desde a última busca.
 *
 * Antes o painel comparava QUANTOS pedidos vieram. O servidor manda só os 200 mais recentes, então num restaurante com
 * mais de 200 pedidos na história a conta nunca subia e o aviso nunca tocava. Pelo número do pedido, não importa o tamanho.
 * Só testado com `node --test`: nada aqui mexe em tela.
 */

type WithId = { id: string };

/** O conjunto de pedidos que a tela já conhece, para a próxima comparação. */
export function knownOrderIds(orders: readonly WithId[]): Set<string> {
  return new Set(orders.map((order) => order.id));
}

/**
 * Os pedidos que não estavam na busca anterior. `known` é null na primeira busca: o que já estava no painel
 * quando ele abriu não faz alarde.
 */
export function newOrders<T extends WithId>(known: ReadonlySet<string> | null, orders: readonly T[]): T[] {
  if (known === null) return [];
  return orders.filter((order) => !known.has(order.id));
}

/** Quem da equipe recebe o aviso de pedido novo: todos menos o entregador, que tem a tela de entregas. */
export function wantsNewOrderAlert(role: string | null | undefined): boolean {
  return Boolean(role) && role !== "COURIER";
}
