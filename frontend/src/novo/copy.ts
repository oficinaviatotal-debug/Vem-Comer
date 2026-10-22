/**
 * Frases fixas do acompanhamento e do Pix, num só lugar: a tela (novo/Tracking.tsx) e a conta (loja/trackingLogic.ts)
 * leem daqui, então a frase que o teste confere é a que a pessoa lê. Só texto: nada daqui depende de React nem de rede.
 */

export const OFFLINE_NOTE = "Sem internet. Mostrando o último andamento.";

export const PIX_STEPS = [
  "Abra o app do seu banco e escolha Pix, depois Pix Copia e Cola.",
  "Cole o código, confira o valor e o nome do recebedor e pague.",
] as const;
export const PIX_ERROR_TEXT = "Não deu para mostrar o código agora. Confira a internet.";
export const PIX_MISSING_TEXT = "Você acerta o pagamento com o atendente.";
export const PIX_AFTER_TEXT = "Depois de pagar, o restaurante confirma e aqui aparece Pagamento recebido.";
export const PIX_COPIED_TEXT = "Código copiado. Agora cole no app do seu banco.";
export const PIX_COPY_MANUAL_TEXT = "Não deu para copiar sozinho. Toque e segure no código abaixo para copiar.";

/** A frase que acompanha o resultado do toque em "Copiar código Pix" (vazio: ainda não tocou). */
export const copiedText = (copied: "" | "ok" | "manual"): string =>
  copied === "ok" ? PIX_COPIED_TEXT : copied === "manual" ? PIX_COPY_MANUAL_TEXT : "";

export const RATING_THANKS = "Obrigado pela sua avaliação!";

/** A tela da mesa (novo/Table.tsx e loja/tableLogic.ts). */
export const TABLE_SUB = "O que você precisa agora?";
export const TABLE_MENU_TEXT = "Ver cardápio e pedir";
export const TABLE_JOBS_TEXT = "Trabalhe aqui";
export const TABLE_SENT_TEXT = "Avisamos o atendente.";
export const CALL_STATUS = { busy: "Avisando…", called: "Chamado", answered: "Atendido", again: "Ainda não veio?" } as const;
export const CALL_NOTES = {
  called: "Aguarde um instante, já vai chegar.",
  answered: "Toque se precisar de novo.",
  again: "Toque para avisar de novo.",
} as const;

/** A tela de mesas do painel (novo/Desk.tsx, novo/DeskTable.tsx e painel/deskLogic.ts). */
export const DESK_TITLE = "Mesas";
export const DESK_QUIET = "Ninguém chamando agora";
export const DESK_CALLS_HEADING = "Chamando agora";
export const DESK_ALL_HEADING = "Todas as mesas";
export const DESK_ANSWER = "Já atendi";
export const DESK_SENDING = "Marcando…";
export const DESK_SCAN = "Ler o QR da mesa";
export const DESK_TYPE_LABEL = "Ou digite o número da mesa";
export const DESK_TYPE_HINT = "Ex.: 4";
export const DESK_OPEN = "Abrir";
export const DESK_LOADING = "Abrindo as mesas…";
export const DESK_NO_TABLES = "Ainda não há mesas cadastradas. Cadastre em Mesas, no menu.";
export const DESK_TABLES_ERROR = "Não consegui abrir a lista de mesas. Confira a internet.";
export const DESK_RETRY = "Tentar de novo";
export const DESK_ANSWER_ERROR = "Não deu para marcar como atendida. Confira a internet e toque de novo.";
export const DESK_TYPE_EMPTY = "Digite o número da mesa.";
export const DESK_TYPE_UNKNOWN = "Não achei essa mesa no cadastro. Confira o número ou toque na lista.";
export const DESK_BACK = "Outras mesas";
export const DESK_NO_CALLS = "Ninguém chamando desta mesa.";
export const DESK_NO_ORDERS = "Nenhum pedido em andamento nesta mesa.";
export const DESK_ORDERS_HEADING = "Pedidos em andamento";
export const DESK_CALLS_OF_TABLE = "Chamados";
export const DESK_MAKE_ORDER = "Fazer um pedido para esta mesa";
export const DESK_MAKE_ORDER_NOTE = "Abre o cardápio desta mesa, como o cliente vê, para você pedir por ele.";
export const DESK_NO_NAME = "Sem nome";
export const DESK_SCAN_HINT = "Aponte para o QR do cartaz da mesa. A leitura é sozinha.";
export const DESK_SCAN_CANCEL = "Cancelar";
export const DESK_AGAIN = "chamou de novo";
export const DESK_AGAIN_FLAG = "Chamou de novo";
export const DESK_WORD = { normal: "", late: "Está demorando", urgent: "Urgente" } as const;

// ---------------------------------------------------------------- Pedidos e caixa (painel)

export const ORDERS_TITLE = "Pedidos";
export const ORDERS_QUIET = "Nenhum pedido agora";
export const ORDERS_TABS_LABEL = "Etapas dos pedidos";
export const ORDERS_RECEIVE = "Pagamento recebido";
export const ORDERS_RECEIVING = "Marcando…";
export const ORDERS_SENDING = "Enviando…";
export const ORDERS_CALL = "Ligar para o cliente";
export const ORDERS_NO_ADDRESS = "Sem endereço: ligue para o cliente";
export const ORDERS_PICKUP = "Cliente retira no balcão";
export const ORDERS_LOAD_ERROR = "Sem conexão com o servidor. Os pedidos na tela podem estar desatualizados.";
export const ORDERS_ADVANCE_ERROR = "Não deu para mudar o pedido. Confira a internet e toque de novo.";
export const ORDERS_RECEIVE_ERROR = "Não deu para marcar como pago. Confira a internet e toque de novo.";
export const ORDERS_EMPTY = {
  new: "Nenhum pedido novo. Quando um cliente pedir, o pedido aparece aqui e o aparelho avisa.",
  doing: "Nada em andamento agora.",
  receive: "Nada esperando pagamento.",
  done: "Ainda não há pedidos encerrados.",
} as const;
export const ORDERS_CHANGED = "Este pedido já mudou. A tela foi atualizada.";
