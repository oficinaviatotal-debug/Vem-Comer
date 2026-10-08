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
remover grupo com dois toques. **Falta ver num celular de verdade** e com o servidor real na VPS.

## O que ainda não faz

- Falar ou fotografar as opções (cadastro por voz, foto e arquivo ainda só lê prato e preço): 09/10.
- Copiar as opções de um prato para outro (ex.: todas as pizzas com os mesmos tamanhos).
- Custo da opção na ficha técnica / CMV, e meio a meio.
