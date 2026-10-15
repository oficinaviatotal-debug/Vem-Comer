/**
 * "Abrir mesa": o garçom (ou quem atende o salão) chega na mesa certa lendo o QR Code dela ou digitando o número.
 * Só regras e palavras, sem tela e sem rede, para testar com `node --test`.
 *
 * Nada aqui inventa número: a mesa vem do cadastro de mesas, os pedidos são os que o painel já busca e os chamados
 * são os que o servidor devolveu. Quando algo não pode ser lido, a tela diz isso em palavras.
 */

export type TableRef = { id: string; number: number; status?: string };

/** O que o QR lido quer dizer para ESTE restaurante. */
export type CodeRead =
  | { kind: "table"; tableId: string }
  | { kind: "other-restaurant" }
  | { kind: "not-a-table" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O servidor só gera QR de até 500 letras (TABLE_QR_MAX_URL_LENGTH); o que passar disso não é nosso. */
const CODE_MAX = 500;

/**
 * O QR da mesa é o link `?empresa=<restaurante>&mesa=<id>`. Só vira mesa quando o restaurante do link é o deste
 * painel: o QR de outro restaurante, um site qualquer ou um texto solto nunca abre mesa nenhuma.
 */
export function readTableCode(text: string, slug: string): CodeRead {
  const raw = String(text ?? "").trim();
  if (!raw || raw.length > CODE_MAX) return { kind: "not-a-table" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "not-a-table" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { kind: "not-a-table" };

  const company = url.searchParams.getAll("empresa");
  const table = url.searchParams.getAll("mesa");
  if (company.length !== 1 || table.length !== 1 || !UUID.test(table[0])) return { kind: "not-a-table" };

  if (company[0].trim().toLowerCase() !== String(slug ?? "").trim().toLowerCase()) return { kind: "other-restaurant" };
  return { kind: "table", tableId: table[0].toLowerCase() };
}

/** A mesa do cadastro com este id (o id do QR), ou null. */
export function tableById(tables: TableRef[], tableId: string): TableRef | null {
  const wanted = String(tableId ?? "").toLowerCase();
  return tables.find((table) => String(table.id).toLowerCase() === wanted) ?? null;
}

/** "4", "04" e "mesa 4" são a mesma mesa. Letras soltas, zero e número gigante não são mesa. */
export function numberFromTyped(typed: string): number | null {
  const text = String(typed ?? "")
    .trim()
    .toLowerCase()
    .replace(/^mesa\s*/, "");
  if (!/^\d{1,4}$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 ? value : null;
}

/** A mesa de número tal, ou null quando o número não existe no cadastro. */
export function tableByNumber(tables: TableRef[], typed: string): TableRef | null {
  const value = numberFromTyped(typed);
  if (value === null) return null;
  return tables.find((table) => Number(table.number) === value) ?? null;
}

// ---------------------------------------------------------------- pedidos e chamados da mesa

export type DeskOrder = {
  id: string;
  status: string;
  order_type?: string | null;
  table_number?: string | number | null;
  customer_name?: string | null;
  total_price?: number | string | null;
  created_at: string;
};

export type DeskCall = { id: string; table_number: number; text: string; waiting_seconds: number; urgency?: string };

/** A palavra do servidor para pedido terminado (service/orderStatus.ts tem a mesma; um teste compara). */
export const STATUS_DONE = "concluido";

/** Os pedidos de salão desta mesa que ainda estão andando (aguardando ou na cozinha), do mais antigo ao mais novo. */
export function activeOrdersOfTable(orders: DeskOrder[], tableNumber: number): DeskOrder[] {
  return orders
    .filter(
      (order) =>
        String(order.order_type ?? "") === "mesa" &&
        Number(order.table_number) === tableNumber &&
        order.status !== STATUS_DONE,
    )
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

export function callsOfTable<T extends DeskCall>(calls: T[], tableNumber: number): T[] {
  return calls.filter((call) => Number(call.table_number) === tableNumber);
}

export type TileTone = "call" | "busy" | "quiet";

export type DeskTile = {
  id: string;
  number: number;
  calls: number;
  orders: number;
  tone: TileTone;
  /** A linha embaixo do número. Diz o que foi contado, nunca "livre" ou "ocupada" (o sistema não sabe). */
  note: string;
};

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `${count} ${one}` : `${count} ${many}`;
}

export function tileNote(calls: number, orders: number): string {
  if (calls > 0) return calls === 1 ? "Chamando" : `${calls} chamados`;
  if (orders > 0) return plural(orders, "pedido", "pedidos");
  return "Sem pedido";
}

/** Uma ficha por mesa cadastrada, em ordem de número. */
export function deskTiles(tables: TableRef[], orders: DeskOrder[], calls: DeskCall[]): DeskTile[] {
  return [...tables]
    .sort((a, b) => a.number - b.number)
    .map((table) => {
      const callCount = callsOfTable(calls, table.number).length;
      const orderCount = activeOrdersOfTable(orders, table.number).length;
      return {
        id: table.id,
        number: table.number,
        calls: callCount,
        orders: orderCount,
        tone: callCount > 0 ? "call" : orderCount > 0 ? "busy" : "quiet",
        note: tileNote(callCount, orderCount),
      };
    });
}

/** "Mesa 4": o título da mesa aberta. */
export function tableTitle(number: number): string {
  return `Mesa ${number}`;
}

/** A linha de cima da mesa aberta: o que existe agora, em palavras. */
export function tableHeadline(calls: number, orders: number): string {
  if (calls === 0 && orders === 0) return "Nenhum chamado e nenhum pedido em andamento";
  const parts: string[] = [];
  if (calls > 0) parts.push(plural(calls, "chamado aberto", "chamados abertos"));
  if (orders > 0) parts.push(plural(orders, "pedido em andamento", "pedidos em andamento"));
  return parts.join(" e ");
}

export const NO_ORDERS = "Nenhum pedido em andamento nesta mesa.";
export const NO_CALLS = "Ninguém chamando desta mesa.";

// ---------------------------------------------------------------- a câmera

/** O que o aparelho oferece para ler QR dentro do aplicativo. */
export type ScanEnvironment = {
  /** `"BarcodeDetector" in window`. */
  hasDetector: boolean;
  /** `navigator.mediaDevices?.getUserMedia` existe. */
  hasCamera: boolean;
  /** `window.isSecureContext`: a câmera só abre em endereço https. */
  secure: boolean;
  /** `document.permissionsPolicy?.allowsFeature("camera")`; undefined quando o navegador não sabe dizer. */
  policyAllows?: boolean;
};

export type ScanSupport = "camera" | "none";

export function scanSupport(env: ScanEnvironment): ScanSupport {
  if (!env.hasDetector || !env.hasCamera || !env.secure) return "none";
  if (env.policyAllows === false) return "none";
  return "camera";
}

export const NO_SCAN_TEXT =
  "Este celular não lê QR aqui dentro. Escolha a mesa na lista ou digite o número. Se preferir, aponte a câmera do celular para o QR da mesa.";

/** O que dizer quando a câmera não abre (o nome do erro vem do navegador). */
export function cameraErrorMessage(name: string): string {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "A câmera está bloqueada para este site. Libere a câmera no navegador, ou escolha a mesa na lista.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Não achei uma câmera neste aparelho. Escolha a mesa na lista.";
    case "NotReadableError":
    case "AbortError":
      return "A câmera está em uso por outro aplicativo. Feche o outro e tente de novo.";
    default:
      return "Não consegui abrir a câmera. Escolha a mesa na lista ou digite o número.";
  }
}

/** O que dizer sobre um QR que abriu, mas não deu mesa. */
export function codeMessage(read: CodeRead, found: boolean): string {
  if (read.kind === "other-restaurant") return "Este QR é de outro restaurante.";
  if (read.kind === "not-a-table") return "Este QR não é de uma mesa. Aponte para o QR do cartaz da mesa.";
  return found ? "" : "Esta mesa não está no cadastro deste restaurante. Escolha na lista.";
}

/** Quanto tempo a tela espera entre uma tentativa de leitura e outra. */
export const SCAN_EVERY_MS = 250;

/** De quanto em quanto tempo a tela pergunta de novo os chamados enquanto está aberta. */
export const DESK_POLL_MS = 8000;
