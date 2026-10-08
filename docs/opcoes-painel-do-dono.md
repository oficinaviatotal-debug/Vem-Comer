# Opções por prato: a tela do dono (painel)

Segunda metade das opções por item (a primeira é o servidor, em `opcoes-por-item.md`). Aqui o dono monta
**tamanho, adicionais e "sem cebola"** de cada prato sem digitar quase nada. A tela do cliente escolher essas
opções é outro pedido (feat/opcoes-cliente) e não depende deste.

## Como o dono usa

1. Painel, aba **Produtos**, botão **Opções** no prato. A tela abre embaixo do prato, no mesmo lugar da foto.
2. Prato sem opção mostra **modelos prontos**: `+ Tamanho` (Pequeno, Médio, Grande), `+ Adicionais`,
   `+ Retirar` (Sem cebola, Sem tomate) e `+ Outro grupo`. Os nomes são só sugestão; é só mudar.
3. Cada grupo tem **Mínimo** (0 = opcional, 1 ou mais = obrigatório) e **Máximo**, e uma frase logo abaixo diz o
   que o cliente vai ver: "O cliente escolhe 1." / "O cliente pode escolher até 3, se quiser."
4. Cada opção tem nome, **preço extra** (vazio = de graça; aceita `6,50`, `6.5`, `R$ 6,50`) e o botão
   **Tem / Acabou**. Opção "Acabou" some do cardápio do cliente mas continua na lista, para voltar com um toque.
5. **Salvar opções** só liga quando algo mudou. Aparece "Não salvo" enquanto houver mudança pendente.
6. **Remover grupo** pede dois toques (igual a remover prato).
7. Na lista de pratos aparece o selo verde "2 grupos de opções" nos pratos que têm opção à venda.

## Falar as opções (sem digitar)

O botão **Falar as opções** (aparece quando o celular sabe escutar) abre o microfone com a mesma paciência do
cardápio falado: pausa para pensar não corta, só uns 3 segundos de silêncio terminam, ou o dono toca em **Pronto**.
O que foi dito vira grupos na tela. **Nada é salvo**: a tela mostra "Você disse", "Entendi" e o dono confere e toca
em Salvar opções.

Exemplo, tudo numa fala só:
`tamanho pequeno, médio mais 5, grande mais 10. adicionais bacon 4, ovo 2 e meio. sem cebola`

O que a fala entende:
- **Grupos**: tamanho, adicionais (extra, complemento), tirar/retirar/"sem ..." (vira "Sem cebola"), sabor, borda,
  molho, recheio, cobertura, calda, massa, ponto da carne. Fala solta sem tipo, sem preço e sem ser tamanho não vira
  opção: a tela pede "diga antes o tipo".
- **Preço**: "mais 5", "+5", "5 reais a mais", "bacon 4", "R$ 4,50", "dois e cinquenta", "dois e meio", "cada um 3
  reais" (vale para todas as opções do grupo que ainda não têm preço).
- **Tamanho com número solto** ("grande 50"): se for pelo menos o preço do prato, é o preço total (50 menos o preço
  do prato vira o acréscimo); muito abaixo do preço do prato ("grande 10" num prato de R$ 28,50), é acréscimo; no meio,
  a tela **não chuta**: deixa sem preço e avisa. Errar isso é cobrar errado de todo cliente.
- Medidas ficam no nome ("300 ml", "4 fatias"). Conversa antes do tipo ("a pizza tem tamanho...") é ignorada.
- Falar de novo **soma** ao que já está na tela: opção que já existe mantém o "Acabou" e só troca o preço se um preço
  novo foi dito. Nunca passa de 8 grupos e 30 opções.

Lógica pura em `frontend/src/service/spokenOptions.ts` (+ `groupFrom` e `mergeGroups` em `optionsDraft.ts`); 31 testes
em `tests/ui/spokenOptions.test.mjs`.

## O que a tela confere antes de enviar (as mesmas regras do servidor)

Nome do grupo e da opção preenchidos (até 60 letras), sem repetir nome, pelo menos uma opção por grupo, no
máximo 8 grupos e 30 opções, preço entre 0 e 999,99. Se algo estiver errado, o dono recebe uma lista em português
("Adicionais: escreva o nome da opção 1.") e nada é enviado. Mínimo e máximo se ajustam sozinhos ao número de
opções (não dá para exigir 3 escolhas num grupo de 2). O servidor confere de novo e continua sendo quem decide.

## Por dentro

- `frontend/src/service/optionsDraft.ts`: lógica pura (rascunho, preço digitado, modelos, validação, frase). 14
  testes em `tests/ui/optionsDraft.test.mjs`.
- `frontend/src/service/ProductOptionsEditor.tsx`: a tela. `AdminPanel.tsx` só abre e fecha.
- `frontend/src/service/api.ts`: `fetchProductOptions` e `saveProductOptions` (`GET/PUT /api/admin/products/<id>/options`).
- Opção já existente volta com o `id` no envio: mudar só o preço não quebra o carrinho de quem está pedindo agora.
  Opção nova vai sem `id` e o servidor cria.

## Conferido no navegador (08/10)

Painel real com respostas simuladas do servidor, em 390 e 320 de largura, sem rolagem horizontal: criar com
modelos, erro em português, salvar (o envio saiu com os preços e o "Acabou" certos), reabrir prato com opções,
remover grupo com dois toques, e a fala (com um microfone de mentira): ouvindo, "Pronto" antes do silêncio, somar a
grupo existente, cancelar, fala sem sentido. **Falta ouvir num celular de verdade** (o reconhecimento de voz do
Android é o que decide o quanto a fala sai limpa) e com o servidor real na VPS.

## O que ainda não faz

- Fotografar o cardápio e já ler tamanhos e adicionais (a leitura por foto e por arquivo ainda só lê prato e preço).
- Dizer as opções no cadastro do cardápio inteiro (hoje se fala dentro de cada prato).
- Copiar as opções de um prato para outro (ex.: todas as pizzas com os mesmos tamanhos).
- Custo da opção na ficha técnica / CMV, e meio a meio.
