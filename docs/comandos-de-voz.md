# O que dá para falar no Vem Comer (comandos de voz)

Este arquivo é **gerado do código** por `tests/novo/comandosDeVoz.test.mjs` e conferido a cada mudança: se uma frase entrar ou sair e este texto não for atualizado, o teste fica vermelho. Para atualizar: `ATUALIZAR=1 node --experimental-strip-types --no-warnings --test tests/novo/comandosDeVoz.test.mjs`.

As frases estão escritas **sem acento e sem maiúscula** porque é assim que a voz as lê: falar com acento, com maiúscula, com pontuação ou com palavras a mais ("por favor, abre os pedidos") dá no mesmo. Quando duas frases servem, vale a **mais comprida**: "resumo do dia" lê o dia, "resumo" abre os números.

**Estado:** conferido por teste automático e no navegador com microfone de teste. **Ainda não testado com voz de verdade em Android e iPhone** (ver `docs/teste-no-celular.md`, "Fica para depois"). As listas de palavras vão ser afinadas com o que os celulares realmente entendem.

## Regras que valem para toda a voz

- **A voz do painel** abre telas, lê como está o dia e, só depois de um "sim", marca prato esgotado. Ela não cria, não paga e não apaga nada.
- **A voz do cliente** põe e tira pratos da **sacola** (sempre com o botão *Desfazer*) e abre telas. Ela **nunca envia o pedido, nunca paga e nunca chama o garçom sozinha**: o envio, o pagamento e a chamada são botões que a pessoa toca.
- **Não adivinha.** Se mais de um prato combina com o que foi falado, a voz lista os nomes e pede o nome inteiro; se nenhum combina, diz isso. Frase que não foi entendida vira uma resposta com exemplos reais, nunca um palpite.
- **Nunca fica em silêncio.** Quem pede uma tela que não pode abrir ouve "não posso abrir isto para você agora"; quem já está na tela ouve que já está nela.

## Painel (dono, gerente e equipe)

### Abrir uma tela

| Tela | Quem abre | O que falar |
| --- | --- | --- |
| Hoje | todos | "inicio", "hoje", "comeco", "voltar", "tela inicial", "tela principal", "o que falta", "o que fazer", "o que preciso fazer" |
| Pedidos | todos | "pedido", "pedidos", "cozinha", "fila", "fila de pedidos", "comanda", "comandas", "novo pedido", "novos pedidos", "conferir pix", "conferir o pix", "confirmar pix", "pix para conferir" |
| Abrir mesa | dono, gerente, garçom, caixa | "mesa", "abrir mesa", "abrir a mesa", "atender mesa", "atender a mesa", "ler qr", "ler o qr", "ler qr code", "ler o qr code", "salao", "chamado", "chamados", "chamando", "mesa chamando", "mesas chamando", "chamados da mesa", "chamados do salao" (quem não abre esta tela vai para "Mesas") |
| Mesas | todos | "mesas", "qr code", "qr das mesas", "cadastrar mesa", "cadastrar mesas", "imprimir qr", "imprimir o qr" |
| Entregas | dono, gerente | "entrega", "entregas", "entregador", "entregadores", "motoqueiro", "motoqueiros", "moto boy", "motoboy", "quem esta na rua", "na rua" |
| Acerto de caixa | dono, gerente, caixa | "acerto", "acerto de caixa", "acertar", "acertar o caixa", "caixa", "fechar caixa", "fechar o caixa", "dinheiro do motoqueiro", "dinheiro dos motoqueiros", "dinheiro dos entregadores" |
| Assistente | dono, gerente | "assistente", "montar cardapio", "montar o cardapio", "criar cardapio", "criar o cardapio", "cadastrar cardapio", "cadastrar o cardapio", "novo cardapio", "falar os pratos", "cardapio por voz", "cardapio por foto", "foto do cardapio", "tirar foto do cardapio", "fotografar o cardapio" |
| Produtos | todos | "produto", "produtos", "prato", "pratos", "cardapio", "preco", "precos", "mudar preco", "mudar o preco", "foto", "fotos", "esgotou", "esgotado", "acabou" |
| Categorias | todos | "categoria", "categorias", "secao", "secoes", "grupos do cardapio" |
| Seu negócio / Resumo | todos | "numero", "numeros", "venda", "vendas", "faturamento", "lucro", "negocio", "meu negocio", "seu negocio", "resumo", "relatorio" |
| Custos | dono, gerente | "custo", "custos", "cmv", "ficha tecnica", "custo do prato", "custo dos pratos" |
| Pagamento | dono, gerente | "pagamento", "pix", "chave pix", "receber pix", "receber por pix" |
| Meu link | dono, gerente | "link", "meu link", "link do cardapio", "compartilhar", "divulgar", "whatsapp", "instagram" |
| Horário | dono, gerente | "horario", "horarios", "pausar", "pausar a loja", "pausar pedidos", "abrir a loja", "fechar a loja", "hora de abrir", "hora de fechar" |
| Regiões de entrega | dono, gerente | "regiao", "regioes", "regioes de entrega", "taxa de entrega", "taxas de entrega", "taxa", "taxas", "retirada", "bairro", "bairros", "frete" |
| Marca | dono, gerente | "marca", "minha marca", "logomarca", "logo", "cores" |
| Equipe | dono | "equipe", "funcionario", "funcionarios", "colaboradores", "usuario", "usuarios", "quem entra" |
| Plano | todos | "plano", "meu plano", "pagar o plano", "pagar plano", "mensalidade", "vencimento" |
| Aprovações | só o dono do sistema | "aprovacao", "aprovacoes", "aprovar", "o que espera meu aval" |
| Assinaturas | só o dono do sistema | "assinaturas" |
| Chamados | só o dono do sistema | "chamados de ajuda", "pedidos de ajuda", "chamados dos donos" |

### Perguntar como está o dia

A voz lê os números do dia (não abre tela): "como esta o dia", "como esta hoje", "como esta indo", "como estamos", "como estou", "como foi o dia", "como estao as vendas", "resumo do dia", "me da um resumo", "me de um resumo", "me atualiza", "me atualize", "novidades", "o que esta acontecendo", "tem pedido", "tem pedidos", "quantos pedidos", "tem mesa chamando", "quanto vendi", "quanto vendi hoje", "quanto ja vendi", "quanto eu vendi", "quanto eu ja vendi", "quanto vendemos", "quanto faturei".

### Pedir ajuda

"ajuda", "socorro", "comandos", "o que posso falar", "o que posso dizer", "como funciona", "o que voce faz": a voz diz o que se pode falar, com exemplos das telas que a pessoa abre.

### Marcar um prato como esgotado, ou de volta

Só para **dono, gerente e cozinha**, e só quem abre *Produtos*. Fala-se o aviso e o nome do prato: "acabou o pastel de carne", "voltou o açaí".

- **Esgotou:** "acabou", "acabaram", "esgotou", "esgotaram", "esgotado", "esgotada", "terminou", "terminaram", "faltou", "nao tem mais", "ficou sem", "estamos sem", "estou sem", "ta sem".
- **Voltou:** "voltou", "voltaram", "chegou", "chegaram", "tem de novo", "ja tem", "temos de novo", "ta de volta", "esta de volta", "tira o esgotado", "tirar o esgotado", "tira esgotado", "tirar esgotado", "desmarca", "desmarcar", "desmarque", "nao esta mais esgotado", "nao ta mais esgotado".
- A voz **diz o nome do prato que entendeu e pergunta**; só muda depois de **sim** ("sim", "pode", "isso", "confirma", "confirmo", "confirmado", "certo", "correto", "ok", "claro", "fechou", "exato", "positivo"). **Não** ("nao", "cancela", "cancelar", "cancelei", "deixa", "esquece", "errado", "errou", "pare"), outra frase ou 30 segundos de silêncio: nada muda.
- "Acabou" sozinho, sem nome de prato, só abre *Produtos*. Frase com "não" ("não acabou o pastel") não marca nada. Conversa de movimento ("o pedido chegou", "a entrega terminou") não é prato: palavras como "pedido", "pedidos", "entrega", "entregas", "entregador", "entregadores", "motoboy", "motoboys", "cliente", "clientes", "mesa", "mesas" e outras impedem.

### Falar o horário

Na tela *Horário*, o botão de falar entende "de segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado". As palavras só preenchem a tela, com "Ainda não foi salvo": **nada é gravado até tocar em *Salvar horário***.

## Cliente (cardápio e pedido)

### Ir para uma tela

| Tela | O que falar |
| --- | --- |
| Cardápio | "cardapio", "menu", "voltar", "inicio", "tela inicial", "ver os pratos", "ver pratos", "ver o cardapio", "ver cardapio", "voltar ao cardapio", "voltar para o cardapio" |
| Sacola | "sacola", "a sacola", "abrir a sacola", "ver a sacola", "ver sacola", "minha sacola", "carrinho", "ver pedido", "ver o pedido", "fechar o pedido", "fechar pedido", "finalizar", "finalizar o pedido", "finalizar pedido", "terminar o pedido", "terminar pedido", "enviar o pedido", "enviar pedido", "mandar o pedido", "mandar pedido", "fazer o pedido", "fazer pedido", "fazer um pedido", "quero pedir", "pagar", "pagamento" |
| Acompanhar o pedido | "acompanhar", "acompanhar pedido", "acompanhar o pedido", "acompanhar meu pedido", "onde esta meu pedido", "onde esta o pedido", "cade meu pedido", "cade o pedido", "meus pedidos", "ver meus pedidos", "status do pedido", "como esta meu pedido", "como esta o pedido", "quanto falta" |
| Mesa (chamar o garçom, pedir a conta) | "garcom", "chamar o garcom", "chamar garcom", "chamar atendente", "chamar o atendente", "atendente", "a conta", "pedir a conta", "pedir conta", "fechar a conta", "minha mesa", "mesa" |

"Meu pedido" ("meu pedido", "o meu pedido", "pedido") abre a sacola, se tem coisa nela; senão, o acompanhamento, se já pediu.

### Pedir, tirar e buscar

- **Pôr na sacola:** "quero", "queria", "queremos", "gostaria", "vou querer", "vou pedir", "me ve", "me de", "me da", "manda", "mandar", "traz", "trazer", "poe", "poem", "bota", "botar", "coloca", "colocar", "adiciona", "adicionar", "pedir" + o nome do prato, com a quantidade se quiser ("quero dois pastéis de carne", "meia dúzia de coxinha"). Só o nome do prato também vale. Prato com tamanho ou extras **não entra direto**: a voz abre as escolhas e a pessoa toca em *Adicionar*.
- **Tirar da sacola:** "tira", "tirar", "remove", "remover", "retira", "retirar", "cancela", "cancelar" + o nome do prato.
- **Buscar no cardápio:** "buscar", "busca", "procurar", "procura", "encontrar", "achar", "pesquisar", "tem", "voces tem", "vcs tem", "tem algum", "tem alguma" + o que procura ("buscar suco", "tem açaí?").
- **Enviar, fechar ou pagar o pedido:** "enviar", "mandar o pedido", "mandar pedido", "finalizar", "fechar o pedido", "fechar pedido", "terminar", "fazer o pedido", "fazer pedido", "fazer um pedido", "quero pedir", "pagar", "pagamento": a voz **só abre a sacola** e diz onde tocar em *Enviar pedido*.

### Pedir ajuda

"ajuda", "me ajuda", "ajudar", "socorro", "como funciona", "o que posso falar", "o que eu posso falar", "o que falo", "o que eu falo", "o que falar", "nao sei": a voz diz o que falar agora, com pratos de verdade do cardápio como exemplo.
