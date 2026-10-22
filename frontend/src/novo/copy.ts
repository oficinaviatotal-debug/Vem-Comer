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

// ---------------------------------------------------------------- Entregas (painel e entregador)

export const DELIVERIES_TITLE = "Entregas";
export const DELIVERIES_QUIET = "Nenhuma entrega agora";
export const DELIVERIES_LOADING = "Abrindo as entregas…";
export const DELIVERIES_TABS_LABEL = "Etapas das entregas";
export const DELIVERIES_TAB = { ready: "Pegar", route: "Na rua", done: "Entregues" } as const;
export const DELIVERIES_EMPTY = {
  ready: "Nenhuma entrega para pegar. Quando a cozinha deixar um pedido pronto, ele aparece aqui e o aparelho avisa.",
  route: "Ninguém está na rua agora.",
  done: "Ainda não há entregas fechadas.",
} as const;
export const DELIVERIES_PICK = "Peguei";
export const DELIVERIES_PICKING = "Pegando…";
export const DELIVERIES_DELIVER = "Entreguei";
export const DELIVERIES_CONFIRM = "Confirmar entrega";
export const DELIVERIES_CONFIRMING = "Confirmando…";
export const DELIVERIES_BACK = "Voltar";
export const DELIVERIES_CALL = "Ligar";
export const DELIVERIES_MAP = "Mapa";
export const DELIVERIES_MAP_OPEN = "Abrir o endereço no mapa";
export const DELIVERIES_NO_ADDRESS = "Endereço não informado";
export const DELIVERIES_OTHER = "Está com outro motoqueiro";
export const DELIVERIES_CODE_LABEL = "Código do cliente";
export const DELIVERIES_CODE_ARIA = "Código do cliente, 4 números";
export const DELIVERIES_CODE_HINT = "Peça ao cliente os 4 números do pedido dele. Só entregue depois de ver o código.";
export const DELIVERIES_NO_CODE = "Este pedido não tem código. Confirme só depois de entregar.";
export const DELIVERIES_LOCKED = "Código bloqueado. Avise o restaurante: ele fecha a entrega pela tela dele.";
export const DELIVERIES_LOAD_ERROR = "Sem sinal. Mostrando a última lista que carregou.";
export const DELIVERIES_PICK_ERROR = "Sem sinal. Tente de novo.";
export const DELIVERIES_CASH_DONE = "acertado com o caixa";
export const DELIVERIES_OFFLINE = "Sem sinal. Não sei se a entrega foi registrada. Toque em Confirmar entrega de novo quando o sinal voltar: não tem problema repetir.";

// ---------------------------------------------------------------- Acerto do caixa (dinheiro dos motoqueiros)

export const SETTLE_TITLE = "Acerto do caixa";
export const SETTLE_QUIET = "Tudo acertado";
export const SETTLE_LOADING = "Abrindo o acerto…";
export const SETTLE_HELP = "Conte o dinheiro que o motoqueiro trouxe, confira as entregas e toque em Recebi. Os pedidos passam a pagos.";
export const SETTLE_EMPTY = "Nenhum dinheiro de motoqueiro em aberto. Tudo acertado.";
export const SETTLE_PICK_HINT = "Marque as entregas que o motoqueiro entregou ao caixa.";
export const SETTLE_ARMED = "Toque de novo para confirmar";
export const SETTLE_BUSY = "Acertando…";
export const SETTLE_REFRESH = "Atualizar a lista";
export const SETTLE_LOAD_ERROR = "Sem sinal. Tente de novo.";
export const SETTLE_ERROR = "Sem sinal. Nada foi acertado. Tente de novo.";
export const SETTLE_CHANGED = "Esta lista já mudou (outra pessoa acertou, ou o valor mudou). A tela foi atualizada: confira de novo.";

// ---------------------------------------------------------------- Cardápio: montar (foto, arquivo, falar os pratos, conferir)

export const MENU_TITLE = "Cardápio";
export const MENU_DOOR_SUB = "Como você quer montar?";
export const MENU_DOOR_LOADING = "Vendo o que este servidor lê…";
export const MENU_DOOR_FOOT = "Em qualquer jeito, no fim você confere tudo antes de cadastrar.";
export const MENU_DOOR_PHOTO = "Foto do cardápio";
export const MENU_DOOR_FILE = "Arquivo do cardápio";
export const MENU_DOOR_SPEAK = "Falar os pratos";
export const MENU_BADGE_FAST = "Mais rápido";
export const MENU_SPEAK_HINT_VOICE = "Diga o prato e o preço. Eu anoto.";
export const MENU_SPEAK_HINT_TYPE = "Escreva os pratos com o preço. Eu anoto.";

export const MENU_PAGES_SUB = "Páginas do cardápio";
export const MENU_PAGES_LABEL = "Páginas do cardápio";
export const MENU_PAGES_HELP = "Uma foto de cada página, de frente, com boa luz e sem reflexo. A foto é usada só para ler o cardápio e não fica guardada.";
export const MENU_READ = "Ler o cardápio";
export const MENU_READ_AGAIN = "Tentar de novo";
export const MENU_TAKE_PHOTO = "Tirar foto do cardápio";
export const MENU_ADD_PAGE = "Tirar outra página";
export const MENU_GALLERY = "Escolher da galeria";
export const MENU_BACK = "Voltar";
export const MENU_PREPARING = "Preparando a foto…";
export const MENU_READING_SUB = "Lendo o cardápio";
export const MENU_READING = "Lendo o cardápio… pode levar até 1 minuto.";
export const MENU_CANCEL = "Cancelar";

export const MENU_SPEAK_SUB = "Diga os pratos com o preço";
export const MENU_SPEAK_EXAMPLE = "Por exemplo: X-tudo, 25 reais. Coca lata, 6. Quando acabar, toque em Pronto.";
export const MENU_MIC = "Falar";
export const MENU_MIC_LISTENING = "Ouvindo… toque para parar";
export const MENU_MIC_OFF = "Este celular não escuta. Escreva os pratos abaixo.";
export const MENU_TYPE_LABEL = "Ou escreva os pratos";
export const MENU_TYPE_HINT = "x-tudo 25, coca 6";
export const MENU_NOTE = "Anotar";
export const MENU_NOTED = "Anotei";
export const MENU_TAKE_OUT = "Tirar";
export const MENU_NO_PRICE = "sem preço";
export const MENU_UNCLEAR = "Não separei isto. Toque para anotar como um prato:";
export const MENU_SPEAK_EMPTY = "Ainda não anotei nenhum prato. Fale o nome e o preço, por exemplo: X-tudo, 25 reais.";
export const MENU_SPEAK_NOT_HEARD = "Não peguei o prato. Fale o nome e o preço, por exemplo: Coca lata, 6.";
export const MENU_SPEAK_ALREADY = "Esses já estavam anotados.";
export const MENU_FINISH = "Pronto, conferir";

export const MENU_REVIEW_SUB = "Conferir o cardápio";
export const MENU_REVIEW_INTRO_READ = "Li o seu cardápio. Corrija o que precisar e cadastre.";
export const MENU_REVIEW_INTRO_SPOKEN = "Confira o que você falou. Corrija o que precisar e cadastre.";
export const MENU_MISSING_HEADING = "Falta o preço";
export const MENU_CHANGE = "Mudar";
export const MENU_CLOSE_EDIT = "Pronto";
export const MENU_NAME_LABEL = "Nome do prato";
export const MENU_PRICE_LABEL = "Preço";
export const MENU_PRICE_HINT = "Ex.: 18,50";
export const MENU_SAVING = "Cadastrando…";
export const MENU_SAVE_ERROR = "Sem sinal. Veja se o celular tem internet e toque em Cadastrar de novo. O que já entrou não repete.";
export const MENU_EMPTY_REVIEW = "Não sobrou nenhum prato. Volte e fale ou fotografe de novo.";

export const MENU_DONE_SUB = "Cardápio cadastrado";
export const MENU_DONE_MORE = "Cadastrar mais pratos";
export const MENU_DONE_SEE = "Ver os pratos";
export const MENU_PRICE_BAD = "Não entendi esse preço. Escreva só números, por exemplo 18,50.";
export const MENU_NAME_BAD = "Esse nome ficou vazio ou já existe nesta categoria.";
export const MENU_USE_GUESS = "Usar";

// ---------------------------------------------------------------- Cardápio: começar de um modelo (tipo de negócio, pratos, preços)

export const MENU_DOOR_MODEL = "Começar de um modelo";
export const MENU_MODEL_HINT = "Escolha o tipo do seu negócio e toque nos pratos que você vende.";
export const MENU_MODEL_SUB = "O que você vende?";
export const MENU_MODEL_LOADING = "Abrindo os tipos de negócio…";
export const MENU_MODEL_OPENING = "Abrindo o modelo…";
export const MENU_MODEL_LABEL = "Digite o que você vende";
export const MENU_MODEL_SEARCH_HINT = "tapioca, bolo, pizza…";
export const MENU_MODEL_ERROR = "Sem sinal. Veja se o celular tem internet e toque em Tentar de novo.";
export const MENU_MODEL_OPEN_ERROR = "Sem sinal. Veja se o celular tem internet e toque no tipo do seu negócio de novo.";
export const MENU_MODEL_EMPTY = "Esse modelo veio sem pratos. Escolha outro, ou volte e fale os pratos.";
export const MENU_MODEL_RETRY = "Tentar de novo";
export const MENU_MODEL_NONE = "Ainda não há modelos prontos. Volte e escolha outro jeito de montar.";
export const MENU_PICK_INTRO = "Toque nos pratos que você vende. Os que você não vende, deixe sem marcar.";
export const MENU_PICK_MARK_ALL = "Marcar todos";
export const MENU_PICK_CLEAR_ALL = "Tirar todos";
export const MENU_PICK_NONE = "Nenhum marcado. Esta categoria fica de fora.";
export const MENU_PICK_NEED_ONE = "Marque pelo menos um prato para seguir.";
export const MENU_PICK_ADD_LABEL = "Falta um prato? Escreva aqui";
export const MENU_PICK_ADD_HINT = "Ex.: Pastel de queijo";
export const MENU_PICK_PRICES = "Colocar os preços";
export const MENU_PRICES_ASK = "Quanto você cobra?";
export const MENU_PRICES_NEXT = "Próximo prato";
export const MENU_PRICES_LAST = "Conferir tudo";
export const MENU_PRICES_DROP = "Tirar este prato";
export const MENU_REVIEW_INTRO_MODEL = "Confira os pratos e os preços. Corrija o que precisar e cadastre.";

export const MENU_FULL = "Já tem 4 páginas. Toque em Ler o cardápio.";
export const MENU_TOO_HEAVY = "As fotos ficaram pesadas demais juntas. Tire uma página de cada vez, ou tire menos páginas.";
export const MENU_READ_ODD = "O servidor respondeu algo que não entendi. Tente de novo.";
export const MENU_READ_TIMEOUT = "A leitura demorou demais. Tente de novo, ou fale os pratos.";
export const MENU_ONLY_FIT = "Só cabem 4 páginas; as outras ficaram de fora.";
export const MENU_NOT_HEARD_ONCE = "Não ouvi nada. Toque em Falar e diga de novo.";
export const MENU_NOT_HEARD_HELP = "Não estou ouvindo. Veja se o microfone está liberado no navegador (cadeado ao lado do endereço) ou escreva os pratos.";

// ---------------------------------------------------------------- Pratos e categorias (o painel de quem cuida do cardápio)

export const DISHES_TITLE = "Pratos";
export const DISHES_TITLE_KITCHEN = "O que esgotou";
export const DISHES_LOADING = "Abrindo os pratos…";
export const DISHES_NONE_SUB = "Nenhum prato ainda";
export const DISHES_EMPTY_OWNER = "Nenhum prato ainda. Toque em Novo prato, ou monte o cardápio todo por foto, arquivo ou voz.";
export const DISHES_EMPTY_KITCHEN = "Ainda não há pratos cadastrados. Peça ao gerente.";
export const DISHES_NEW = "Novo prato";
export const DISHES_MAKE_MENU = "Montar por foto, arquivo ou voz";
export const DISHES_SOLD = "Esgotou";
export const DISHES_BACK = "Voltou";
export const DISHES_SOLD_CHIP = "Esgotado";
export const DISHES_RESET = "Voltou tudo";
export const DISHES_RESETTING = "Voltando…";
export const DISHES_REMOVE_ARM = "Toque de novo para remover";
export const DISHES_REMOVING = "Removendo…";
export const DISHES_REFRESH = "Atualizar a lista";
export const DISHES_SEARCH = "Buscar prato";
export const DISHES_LOAD_ERROR = "Sem sinal. Tente de novo.";
export const DISHES_SOLD_ERROR = "Não consegui marcar o prato. Tente de novo.";
export const DISHES_RESET_ERROR = "Não consegui desmarcar os pratos. Tente de novo.";
export const DISHES_REMOVE_ERROR = "Não consegui remover o prato. Tente de novo. Se não der, toque em Esgotou para ninguém mais pedir.";
export const DISHES_ADD_ERROR = "Sem sinal. Antes de tentar de novo, veja na lista se o prato já entrou.";
export const DISHES_RESET_DONE = "Todos os pratos voltaram.";
export const DISHES_EDITING = "Mudando este prato";
/** Sem sinal ao salvar: a resposta pode ter se perdido depois de o servidor mudar, então manda olhar a lista antes de repetir. */
export const DISHES_EDIT_ERROR = "Sem sinal. Antes de tentar de novo, veja na lista se o prato já mudou.";
export const DISHES_EDIT_MISSING = "O servidor ainda não sabe mudar prato. Falta atualizá-lo.";
export const DISHES_EDIT_GONE = "Esse prato não está mais na lista. Alguém o removeu.";

export const DISH_FORM_TITLE = "Novo prato";
export const DISH_EDIT_TITLE = "Mudar o prato";
export const DISH_SAVE = "Salvar";
export const DISH_SAVING = "Salvando…";
export const DISH_CANCEL = "Cancelar";
export const DISH_NAME_LABEL = "Nome do prato";
export const DISH_NAME_HINT = "Ex.: Combinado 20 peças";
export const DISH_PRICE_LABEL = "Preço";
export const DISH_PRICE_HINT = "Ex.: 49,90";
export const DISH_MENU_LABEL = "Categoria";
export const DISH_NO_MENU = "Sem categoria";
export const DISH_TEXT_LABEL = "O que vem no prato (se quiser)";
export const DISH_ADD = "Adicionar prato";
export const DISH_ADDING = "Adicionando…";
export const DISH_CLOSE = "Fechar";
export const DISH_NAME_MISSING = "Escreva o nome do prato.";
export const DISH_NAME_TWICE = "Esse prato já existe nesta categoria.";

export const CATS_TITLE = "Categorias";
export const CATS_LOADING = "Abrindo as categorias…";
export const CATS_NONE_SUB = "Nenhuma categoria ainda";
export const CATS_EMPTY = "Nenhuma categoria ainda. Crie a primeira, por exemplo Pratos, Bebidas ou Sobremesas.";
export const CATS_HELP = "Categorias são as seções do cardápio. Ao remover uma, os pratos dela não somem: ficam sem categoria.";
export const CATS_NAME_LABEL = "Nome da categoria";
export const CATS_NAME_HINT = "Ex.: Bebidas";
export const CATS_ADD = "Adicionar categoria";
export const CATS_ADDING = "Adicionando…";
export const CATS_NAME_MISSING = "Escreva o nome da categoria.";
export const CATS_NAME_TWICE = "Essa categoria já existe.";
export const CATS_LOAD_ERROR = "Sem sinal. Tente de novo.";
export const CATS_ADD_ERROR = "Sem sinal. Antes de tentar de novo, veja na lista se a categoria já entrou.";
export const CATS_REMOVE_ERROR = "Não consegui remover a categoria. Tente de novo.";
