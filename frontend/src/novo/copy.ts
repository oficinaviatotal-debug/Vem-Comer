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
export const MENU_DOOR_PHOTO = "Tirar foto do cardápio";
export const MENU_DOOR_GALLERY = "Escolher foto do celular";
export const MENU_DOOR_FILE = "Anexar arquivo";
export const MENU_DOOR_SPEAK = "Falar os pratos";
export const MENU_DOOR_WRITE = "Escrever os pratos";
export const MENU_BADGE_FAST = "Mais rápido";
export const MENU_PHOTO_HINT = "Abre a câmera. Eu leio os pratos, o que vai dentro e os preços.";
export const MENU_GALLERY_HINT = "Uma foto do cardápio que já está no celular. Pode ser mais de uma.";
export const MENU_SPEAK_HINT_VOICE = "Diga o prato, o preço e o que vai dentro. Eu anoto.";
export const MENU_WRITE_HINT = "Escreva do seu jeito, por exemplo: X-tudo 25, tem ovo e bacon.";

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
export const MENU_SPEAK_EXAMPLE = "Por exemplo: cadastre um X-tudo, custa 25, vai ter ovo, bacon e salame. Depois: coca lata, 6. Quando acabar, toque em Pronto.";
export const MENU_MIC = "Falar";
export const MENU_MIC_LISTENING = "Ouvindo… toque para parar";
export const MENU_MIC_OFF = "Este celular não escuta. Escreva os pratos abaixo.";
export const MENU_TYPE_LABEL = "Ou escreva os pratos";
export const MENU_TYPE_HINT = "x-tudo 25, tem ovo e bacon";
export const MENU_TYPE_HELP = "Um prato por linha. Depois do preço, escreva o que vai dentro.";
export const MENU_NOTE = "Anotar";
export const MENU_NOTED = "Anotei";
export const MENU_TAKE_OUT = "Tirar";
export const MENU_NO_PRICE = "sem preço";
export const MENU_UNCLEAR = "Não separei isto. Toque para anotar como um prato:";
export const MENU_SPEAK_EMPTY = "Ainda não anotei nenhum prato. Fale o nome e o preço, por exemplo: X-tudo, 25 reais.";
export const MENU_SPEAK_NOT_HEARD = "Não peguei o prato. Fale o nome e o preço, por exemplo: Coca lata, 6.";
export const MENU_SPEAK_ALREADY = "Esses já estavam anotados.";
export const MENU_SPEAK_NO_DISH = "Não achei de qual prato é isso. Diga o nome do prato primeiro, por exemplo: X-tudo, 25 reais.";
export const MENU_FINISH = "Pronto, conferir";

export const MENU_REVIEW_SUB = "Conferir o cardápio";
export const MENU_REVIEW_INTRO_READ = "Li o seu cardápio. Corrija o que precisar e cadastre.";
export const MENU_REVIEW_INTRO_SPOKEN = "Confira o que você falou. Corrija o que precisar e cadastre.";
export const MENU_MISSING_HEADING = "Falta o preço";
export const MENU_CHANGE = "Mudar";
export const MENU_CLOSE_EDIT = "Pronto";
export const MENU_NAME_LABEL = "Nome do prato";
export const MENU_PRICE_LABEL = "Preço";
export const MENU_INSIDE_LABEL = "O que vai dentro (se quiser)";
export const MENU_INSIDE_HINT = "ovo, bacon, hambúrguer, salame";
export const MENU_PRICE_HINT = "Ex.: 18,50";
export const MENU_SAVING = "Cadastrando…";
export const MENU_SAVE_ERROR = "Sem sinal. Veja se o celular tem internet e toque em Cadastrar de novo. O que já entrou não repete.";
export const MENU_EMPTY_REVIEW = "Não sobrou nenhum prato. Volte e fale ou fotografe de novo.";

export const MENU_DONE_SUB = "Cardápio cadastrado";
export const MENU_DONE_MORE = "Cadastrar mais pratos";
export const MENU_DONE_SEE = "Ver os pratos";
export const MENU_DONE_NEXT = "O que falta";
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
/** A foto do prato, dentro do lápis: tirar na hora, escolher uma que já está no celular, ou tirar a que está lá. */
export const DISH_PHOTO_LABEL = "Foto do prato";
export const DISH_PHOTO_TAKE = "Tirar foto";
export const DISH_PHOTO_PICK = "Escolher do celular";
export const DISH_PHOTO_REMOVE = "Tirar a foto";
export const DISH_PHOTO_NONE = "Este prato ainda não tem foto.";
export const DISH_PHOTO_HAS = "Esta é a foto do prato. Para trocar, tire outra.";
export const DISH_PHOTO_PREPARING = "Preparando a foto…";
export const DISH_PHOTO_SENDING = "Enviando a foto…";
export const DISH_PHOTO_REMOVING = "Tirando a foto…";
export const DISH_PHOTO_SAVED = "Foto salva.";
export const DISH_PHOTO_GONE = "Foto tirada.";
export const DISH_PHOTO_REMOVE_ERROR = "Não consegui tirar a foto. Veja se o celular está com internet e tente de novo.";
export const DISHES_NO_PHOTO_CHIP = "Sem foto";
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

// ------------------------------------------------------------------------------------------------ opções do prato (tamanho, adicionais, retirar)

/** No lápis do prato: o resumo das opções de hoje e o botão que leva à tela das opções. */
export const DISH_OPTIONS_LABEL = "Opções do prato";
export const DISH_OPTIONS_NONE = "Sem opções. Serve para tamanho, adicional ou retirar algo.";
export const DISH_OPTIONS_MAKE = "Montar as opções";
export const DISH_OPTIONS_CHANGE = "Mudar as opções";

export const OPT_TITLE = "Opções";
export const OPT_LOADING = "Abrindo as opções…";
export const OPT_LOAD_ERROR = "Não consegui abrir as opções deste prato.";
export const OPT_RETRY = "Tentar de novo";
export const OPT_BACK = "Voltar aos pratos";
export const OPT_BACK_ARMED = "Sair sem salvar? Toque de novo";

export const OPT_INTRO_NONE_VOICE = "Este prato não tem opções. Fale como o cliente escolhe, escreva ou toque em um modelo. Os nomes são só sugestões: é só mudar.";
export const OPT_INTRO_NONE = "Este prato não tem opções. Escreva como o cliente escolhe ou toque em um modelo. Os nomes são só sugestões: é só mudar.";
export const OPT_INTRO_HAS = "O cliente escolhe antes de pedir. O preço de cada opção soma no prato; deixe vazio se não custa a mais. Se uma opção acabar, toque em Tem e vira Acabou.";

export const OPT_MIC = "Falar as opções";
export const OPT_MIC_LISTENING = "Estou ouvindo. Toque para parar";
export const OPT_MIC_OFF = "Este celular não escuta. Escreva as opções ou toque em um modelo.";
export const OPT_SAY_EXAMPLE = "Exemplo: tamanho pequeno, médio mais 5, grande mais 10. Adicionais bacon 4, ovo 2. Sem cebola.";
export const OPT_TYPE_LABEL = "Ou escreva as opções";
export const OPT_TYPE_HINT = "Ex.: tamanho pequeno, grande mais 6";
export const OPT_NOTE = "Anotar";

export const OPT_YOU_SAID = "Você disse:";
export const OPT_UNDERSTOOD = "Entendi:";
export const OPT_CHECK_BELOW = "Confira abaixo e toque em Salvar as opções. Ainda não foi salvo.";
export const OPT_NOT_UNDERSTOOD = "Não entendi nenhuma opção.";
export const OPT_NOT_HEARD = "Não ouvi nada.";
export const OPT_CLOSE_NOTICE = "Fechar aviso";

export const OPT_STARTERS_NONE = "Começar com um modelo";
export const OPT_STARTERS_MORE = "Pôr mais um grupo";

export const OPT_GROUP_NAME = "Nome do grupo";
export const OPT_GROUP_NAME_HINT = "Ex.: Tamanho";
export const OPT_REQUIRED_Q = "O cliente precisa escolher?";
export const OPT_YES = "Sim";
export const OPT_NO = "Não";
export const OPT_HOW_MANY = "Pode escolher até";
export const OPT_AT_LEAST = "Tem que escolher pelo menos";
export const OPT_ITEM_NAME_HINT = "Nome da opção";
export const OPT_ITEM_PRICE_HINT = "+ R$ 0,00";
export const OPT_HAVE = "Tem";
export const OPT_GONE = "Acabou";
export const OPT_ADD_ITEM = "Pôr outra opção";
export const OPT_REMOVE_GROUP = "Tirar o grupo";
export const OPT_REMOVE_GROUP_ARMED = "Toque de novo para tirar";

export const OPT_SAVE = "Salvar as opções";
export const OPT_SAVING = "Salvando…";
export const OPT_UNSAVED = "Falta salvar. O cliente só vê depois de salvar.";
export const OPT_PROBLEMS = "Falta acertar:";
export const OPT_SAVED = "Opções salvas. O cliente já vê no cardápio.";
export const OPT_SAVED_NONE = "Pronto. Este prato ficou sem opções.";
export const OPT_SAVE_ERROR = "Não consegui salvar as opções. Tente de novo.";

/* ------------------------------------------------------------------------------------------------ logomarca (20ª rodada) */

export const LOGO_TITLE = "Logomarca";
export const LOGO_SUB_FALLBACK = "O que o cliente vê no alto do cardápio";
export const LOGO_LOADING = "Abrindo a logomarca…";
export const LOGO_LOAD_ERROR = "Não consegui abrir a logomarca. Confira a internet e tente de novo.";
export const LOGO_RETRY = "Tentar de novo";
export const LOGO_BACK = "Voltar";

export const LOGO_LEAD_NONE = "O seu cardápio ainda está sem logomarca. Sem ela, o cliente vê só o nome do restaurante.";
export const LOGO_LEAD_HAS = "É esta a logomarca que o cliente vê no alto do cardápio.";
export const LOGO_NEXT_NONE = "Tire uma foto da sua placa ou escolha uma imagem do celular. Se não tiver nenhuma, crie uma de graça em três toques.";
export const LOGO_NEXT_HAS = "Quer trocar? Tire outra foto, escolha outra imagem ou crie uma nova.";
export const LOGO_TIP = "Imagem com fundo transparente (PNG) fica melhor no cardápio.";
export const LOGO_FRAME_NONE = "Sem logomarca";
export const LOGO_FRAME_ALT = "A logomarca de agora";

export const LOGO_TAKE = "Tirar foto da logomarca";
export const LOGO_PICK = "Escolher do celular";
export const LOGO_MAKE = "Criar minha logomarca";
export const LOGO_MAKE_ANOTHER = "Criar outra logomarca";
export const LOGO_REMOVE = "Remover a logomarca";
export const LOGO_REMOVE_ARMED = "Toque de novo para remover";

export const LOGO_OPENING = "Abrindo a imagem…";
export const LOGO_SAVING = "Salvando…";
export const LOGO_REMOVING = "Removendo…";
export const LOGO_SAVED = "Logomarca salva. O cliente já vê no cardápio.";
export const LOGO_REMOVED = "Logomarca removida. O cardápio volta a mostrar só o nome.";
export const LOGO_NOTHING_SAVED = "Nada foi salvo.";
export const LOGO_OPEN_FAIL = "Não consegui abrir a imagem. Tente de novo.";
export const LOGO_SEND_FAIL = "Não consegui enviar a logomarca. Tente de novo.";
export const LOGO_REMOVE_FAIL = "Não consegui remover a logomarca. Tente de novo.";
export const LOGO_MAKE_FAIL = "Não consegui montar a logomarca. Tente de novo.";

export const LOGO_REVIEW_TITLE = "Ficou bom?";
export const LOGO_REVIEW_NOT_SAVED = "Ainda não foi salvo.";
export const LOGO_REVIEW_LEAD = "Veja como o cliente vai ver a sua logomarca no cardápio.";
export const LOGO_REVIEW_LEAD_REFINED = "Tirei a margem vazia em volta e centralizei, para a logomarca aparecer maior no cardápio.";
export const LOGO_SENT = "A que você mandou";
export const LOGO_ADJUSTED = "Depois do ajuste";
export const LOGO_SENT_ALT = "Logomarca que você mandou";
export const LOGO_ADJUSTED_ALT = "Logomarca depois do ajuste";
export const LOGO_AS_SEEN = "Assim o cliente vê, no alto do cardápio.";
export const LOGO_NAME_FALLBACK = "Seu restaurante";
export const LOGO_TOO_LIGHT = "Essa logomarca é muito clara e pode sumir no fundo branco do cardápio. Se não aparecer bem acima, escolha uma versão mais escura.";
export const LOGO_SMALL = "Essa imagem é pequena e pode ficar borrada. Se tiver uma maior, escolha ela.";
export const LOGO_USE = "Sim, usar esta";
export const LOGO_USE_ORIGINAL = "Usar a original, sem ajuste";
export const LOGO_USE_ADJUSTED = "Usar a versão ajustada";
export const LOGO_OTHER_TAKE = "Tirar outra foto";
export const LOGO_OTHER_PICK = "Escolher outra imagem";
export const LOGO_CANCEL = "Cancelar";

export const LOGO_STEP_OF = (step: number): string => `Passo ${step} de 3`;
export const LOGO_Q1 = "O que você vende?";
export const LOGO_Q2 = "Qual é a cor da sua fachada?";
export const LOGO_Q2_HINT = "Sem fachada, escolha a cor que você mais gosta.";
export const LOGO_Q3 = "Escolha o modelo";
export const LOGO_GUESS = "parece ser este";
export const LOGO_LIVE_ALT = "Como a logomarca está ficando";
export const LOGO_MODEL_ALT = (label: string): string => `Modelo ${label}`;
export const LOGO_NEXT = "Continuar";
export const LOGO_PREV = "Voltar";
export const LOGO_MAKER_SAVE = "Usar esta logomarca";
export const LOGO_NEXT_HINT = "Toque em uma figura para continuar.";

export const LOGO_SAY_FOOD = "Falar o que eu vendo";
export const LOGO_SAY_NAME = "Falar o nome";
export const LOGO_LISTENING = "Estou ouvindo. Toque para parar";
export const LOGO_SAY_FOOD_EXAMPLE = "Diga, por exemplo: pizzaria, lanchonete, açaí.";
export const LOGO_SAY_NAME_EXAMPLE = "Diga o nome do restaurante.";
export const LOGO_FOOD_MIC_OFF = "Este celular não escuta. Toque em uma das figuras.";
export const LOGO_NAME_MIC_OFF = "Este celular não escuta. Escreva o nome no campo.";
export const LOGO_HEARD_FOOD = (label: string): string => `Entendi: ${label}. Se estiver certo, toque em Continuar.`;
export const LOGO_HEARD_FOOD_NONE = "Não entendi. Toque em uma das figuras.";
export const LOGO_HEARD_NONE = "Não ouvi nada. Toque em Falar e tente de novo.";
export const LOGO_HEARD_NAME = (name: string): string => `Escrevi: ${name}. Confira no campo abaixo.`;

export const LOGO_NAME_LABEL = "Nome na logomarca";
export const LOGO_NAME_HINT = "Se o nome for comprido, escreva aqui uma versão curta. Só muda na logomarca.";
export const LOGO_NAME_CUT = "O nome ficou cortado em alguns modelos. Escreva uma versão mais curta.";
export const LOGO_NAME_EMPTY = "Escreva o nome que vai aparecer na logomarca.";

// ---------------------------------------------------------------- a entrada do painel e a casca

export const LOGIN_TITLE = "Entrar no painel";
export const LOGIN_LEAD = "Entre com o e-mail e a senha do seu cadastro.";
export const LOGIN_EMAIL_LABEL = "E-mail";
export const LOGIN_EMAIL_HINT = "voce@restaurante.com";
export const LOGIN_PASSWORD_LABEL = "Senha";
export const LOGIN_SHOW = "Mostrar a senha";
export const LOGIN_HIDE = "Esconder a senha";
export const LOGIN_SUBMIT = "Entrar";
export const LOGIN_SUBMITTING = "Entrando…";
export const LOGIN_BACK = "Voltar ao cardápio";
export const LOGIN_ENDED = "Seu acesso terminou. Entre de novo para continuar de onde parou.";
export const LOGIN_NO_EMAIL = "Escreva o seu e-mail.";
export const LOGIN_BAD_EMAIL = "O e-mail precisa ter o @. Por exemplo: voce@restaurante.com.";
export const LOGIN_NO_PASSWORD = "Escreva a sua senha.";
export const LOGIN_WRONG = "O e-mail ou a senha não conferem. Confira e toque em Entrar de novo.";
export const LOGIN_OFFLINE = "Sem conexão com o servidor. Confira a internet e toque em Entrar de novo.";
export const LOGIN_SERVER = "O servidor não respondeu direito. Toque em Entrar de novo em instantes.";
export const LOGIN_TOO_MANY = "Muitas tentativas seguidas. Espere um pouco e toque em Entrar de novo.";

export const SHELL_OPENING = "Abrindo o painel…";
export const SHELL_OLD_NOTE = "Esta tela ainda está no desenho antigo. Ela funciona igual; o desenho novo chega na próxima rodada.";
export const SHELL_OLD_LOADING = "Abrindo a tela…";
export const SHELL_OLD_FAIL = "Não consegui abrir esta tela. Confira a internet e toque em Tentar de novo.";
export const SHELL_RETRY = "Tentar de novo";

// ---------------------------------------------------------------- a bolinha de voz do painel (ir para uma tela falando)

// As frases que variam (ouvindo, não entendi, abrindo…, o resumo do dia) moram em `voiceCopy.ts`, com o motor em `phrasing.ts`.
// Aqui ficam só as que nunca mudam: o rótulo do botão e do que a pessoa disse.
export const VOICE_HEARD = (words: string): string => `Você disse: “${words}”`;
export const VOICE_CLOSE = "Fechar";
export const VOICE_BUBBLE_LABEL = "A bolinha de voz";
