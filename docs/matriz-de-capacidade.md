# Matriz de capacidade do Vem Comer (07/10/2026)

O que o dono de restaurante, sorveteria, açaí e lanchonete precisa, contra o que o código faz hoje.
Conferido no esquema do banco (`database/schema.sql` e migrações), nas rotas de `backend/app.py`, nas telas de
`frontend/src` e nos documentos de `docs/`. **Não é teste no celular**: "Pronto" quer dizer que o código existe,
não que um dono já usou.

Situações: **Pronto**, **Em PR** (feito, esperando o GD juntar), **Em parte**, **Falta**.

## Resumo

- O Vem Comer já faz o pedido na mesa pelo QR, o painel de pedidos, o Pix do próprio restaurante, o custo do prato e
  o CMV, o cardápio por voz e por foto, a foto do prato melhorada sozinha, a logomarca e a chamada de garçom (PR #33).
- **Não faz ainda**: entrega (endereço, taxa, motoqueiro), opções por item (tamanho, adicionais, sabor, observação),
  venda por peso, horário de funcionamento, cobrança e bloqueio da assinatura, impressão, telas de garçom e cozinha,
  caixa com conciliação, cupom e fidelidade, notificação.
- **Para sorveteria e açaí a distância é maior**: o produto tem um preço só e a quantidade é um número inteiro. Não dá
  para vender "açaí de 500 ml com 3 complementos" nem "sorvete por quilo".
- **A entrega é o que o GD vende** (cardápio, venda e entrega) e hoje não existe: o pedido não tem endereço, tipo
  (mesa, retirada, entrega) nem taxa, e não há cadastro de entregador.

## Vender

| Necessidade do dono | Situação | O que existe ou o que falta |
|---|---|---|
| Cardápio digital com categorias, foto e QR da mesa | Pronto | `menus`, `products`, fotos, QR por mesa. |
| Pedido do cliente (nome, Pix, cartão ou dinheiro com troco) | Pronto | `orders`, `payment-options`. |
| Pix que cai direto na conta do restaurante | Pronto | Só com a chave do próprio restaurante (`pix-restaurante.md`). |
| Acompanhar o pedido (cliente) e o painel de pedidos (dono) | Em parte | Os estados são só "em preparo" e "concluído". Faltam "pronto" e "saiu para entrega". |
| Chamar garçom, pedir a conta, água, limpeza | Em PR | PR #33 (Mesa viva). |
| Opções por item: tamanho, adicionais, sabor, "sem cebola", meio a meio | Falta | `products` tem um preço; `order_items` não guarda opção nem observação. |
| Venda por peso e por montagem (açaí, sorvete, marmita) | Falta | A quantidade é inteira. O custo conhece "quilo"; o pedido não. |
| Entrega: endereço, taxa por região, retirada, motoqueiro | Falta | `orders` sem endereço, tipo e taxa. Detalha os itens 42, 56 e 62. |
| Horário de funcionamento e "loja fechada" no cardápio | Falta | A tabela `business_hours` existe, mas nada a usa. |
| Esgotado com um toque | Falta | O produto tem `active`, mas o painel só mostra o estado dos usuários, não há botão para o prato. |
| Cupom, fidelidade e campanha | Falta | Itens 51 e 54. |

## Gerir

| Necessidade do dono | Situação | O que existe ou o que falta |
|---|---|---|
| Custo do prato, CMV, ficha técnica e estoque de insumos | Pronto | `006_custos`, `007_rendimento_estoque`, `docs/custos-e-cmv.md`. |
| Cadastro do restaurante pela internet e guia de primeiros passos | Pronto | Fechado até o GD abrir (`abrir-cadastro.sh`). |
| Perfis: dono, gerente, garçom, caixa, cozinha, entregador | Em parte | Os papéis existem no login; só dono e gerente têm tela útil. |
| Telas do garçom, da cozinha e do balcão | Falta | Itens 48, 49, 50 e 65. |
| Caixa: quem recebeu, dinheiro em aberto, conciliação | Falta | Itens 47 e 50. |
| Impressão do cupom e da comanda (58 e 80 mm) | Falta | Item 54. |
| "Bom dia do dono", indicadores e alertas | Falta | Itens 55 e 60. |
| **Assinatura de R$ 190, pagamento no primeiro dia e bloqueio** | Falta | Item 66. Não há tabela de plano, assinatura ou pagamento. |
| Conversar com o sistema por voz ou texto | Falta | Item 64. |

## Cadastrar rápido: a meta de 3 dias

Pedido do GD (07/10): o dono paga no primeiro dia, e o cardápio dele tem de ficar todo cadastrado em até 3 dias, com
tutorial passo a passo, principalmente por voz, foto ou arquivo, sem digitar. Foto de prato e logomarca saem melhoradas
sozinhas.

| O que o GD pediu | Situação | O que existe ou o que falta |
|---|---|---|
| Falar o cardápio | Pronto | `assistente-cardapio-voz.md` (PRs #25 a #31). Falta o GD testar no celular. |
| Foto do cardápio que o dono já tem | Pronto | Até 4 páginas, lê categorias, pratos e preços, e o dono confere (`cardapio-por-foto.md`). |
| Arquivo (planilha ou PDF) | Falta | PDF entra só como foto. A importação por rota aceita apenas o formato interno do sistema. |
| Foto de cada prato melhorada sozinha | Pronto | `fotos-dos-pratos.md`: mostra a original e a melhorada, e dá dica de luz. |
| Logomarca para quem não tem | Pronto | Criar em 3 toques, 13 desenhos e 9 cores (`logomarca.md`). |
| Logomarca que o dono já tem, refinada, com "ficou bom?" | Em parte | O envio existe e ajusta a imagem. Não achei no código nem nos documentos a pergunta com o antes e o depois. |
| Tutorial em sequência que fala e pisca no ponto da tela | Pronto | `onboarding-guiado.md`. |
| Cadastrar tudo em até 3 dias | Falta medir | Nenhum dono cronometrou. Sem um teste de verdade, é uma promessa. |
| Suporte quando o dono trava | Falta | Precisa de um botão "Preciso de ajuda" que chegue a uma pessoa enquanto o assistente não resolve tudo. |

## O que cada tipo de negócio consegue hoje

| Tipo | Hoje | Falta para vender de verdade |
|---|---|---|
| Marmitaria e prato feito (preço fixo) | Atende no salão pelo QR | Entrega. |
| Lanchonete e hamburgueria | Atende no salão, sem adicional | Adicionais, "sem cebola", entrega. |
| Pizzaria | Só pizza de preço único | Tamanho, meio a meio, entrega. |
| Açaí | Só item de preço fixo | Tamanho, complementos, montagem, entrega. |
| Sorveteria | Só item de preço fixo | Venda por peso e por bola, sabores, entrega. |

## Ordem proposta

1. **Opções e observação por item**: grupos de escolha (uma, várias com limite, com preço a mais). Destrava lanchonete,
   pizzaria e açaí de copo.
2. **Entrega**: tipo do pedido, endereço, taxa por região do CEP, retirada e estados "pronto" e "saiu para entrega".
3. **Peso**: preço por quilo com o peso informado no balcão. Destrava a sorveteria por quilo.
4. **Horário de funcionamento e esgotado**: pequenos, e o cliente sente na hora.
5. **Assinatura, pagamento no primeiro dia e bloqueio** (item 66), antes do primeiro cliente pagante.
6. **Cadastro em 3 dias**: arquivo, "ficou bom?" na logomarca, botão de ajuda e um teste cronometrado.
7. **Front-end e voz prontos para mostrar**, em paralelo, porque é o que o dono vê primeiro.

## Limite desta matriz

A lista de necessidades vem dos 14 sites lidos no benchmark e dos 65 requisitos do GD. Os mais de 200 benchmarks dele e
a segunda passada pelo navegador do Dell podem acrescentar linhas. Esta matriz será refeita depois dessa passada.
