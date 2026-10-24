# Acessibilidade do visual novo

Escrito em 24/10/2026, a pedido do GD (23/10/2026, 21:22: "verificando os botões, verificando os comandos, a acessibilidade"). O público do Vem Comer inclui quem lê pouco, quem usa o celular com a mão suja, quem aumentou a letra do aparelho e quem usa leitor de tela. Acessibilidade aqui não é enfeite: é o mesmo trabalho de "menos escrita, mais facilidade".

**Estado:** medido por máquina em mais de 160 telas da página de conferência (`preview-novo.html`), em celular de 390, 360 e 320 px de largura. **Não foi testado em celular de verdade nem com TalkBack ou VoiceOver**; isso está na lista de pendências (`docs/teste-no-celular.md`, "Fica para depois").

## O que é medido

| Medição | O que mede | Resultado |
| --- | --- | --- |
| Leitor automático (axe-core, WCAG 2.2 AA e boas práticas) | botões e campos com nome, papéis certos, listas, pontos de referência, ordem de títulos, idioma | **0 defeitos** em 390 e em 320 px |
| Contraste de verdade (foto do fundo atrás de cada texto) | letra contra o fundo real, inclusive degradê e relevo 3D, que o leitor não calcula | **0 abaixo do mínimo** (4,5:1; 3:1 para letra grande) |
| Tamanho de dedo e foco | todo botão, campo e link com pelo menos 44 × 44 px; contorno de foco de 2 px ao andar com Tab | **0 pequenos, 0 sem contorno** |
| Letra grande (×1,5 e ×2) | tela que rola de lado ou texto cortado | **0 telas** em 360 e 320 px |
| Teste de regras (`tests/novo/acessibilidade.test.mjs`, roda no GitHub) | contas de contraste das cores do sistema visual e as regras de HTML e CSS que já deram defeito | 17 testes |

As quatro primeiras ficam em `tests/navegador/acessibilidade/` (`rodar.sh`, veja o `README.md` de lá). Precisam de navegador, então rodam no computador de quem mexe no visual e **não** no GitHub. O teste de regras roda sempre no GitHub e impede que o defeito consertado volte.

## O que a medição achou e foi consertado

**Contraste (letra clara demais):**

- Texto de apoio (`--nv-muted`) dava 4,37:1 no fundo creme; agora `#4d6157`, acima de 4,5:1 em todos os fundos claros.
- Texto de link e de destaque (`--nv-fire-text`): o primeiro ajuste (`#c74700`) ainda dava 4,27:1; agora `#b84200`.
- Azul do Vem Trabalhar (`--nv-fire` dentro de `.nv-work`) dava 4,2:1 com letra branca; agora `#1650e0`.
- O balãozinho laranja de atalho para o Vem Comer: `#b84200` com letra branca.
- O cartão de prato que está sendo mudado ficava com 60% de opacidade e as etiquetas caíam a 3,2:1; agora 80%.

**Leitor de tela (o que ele ouvia errado ou não ouvia):**

- O aviso (`role="status"` ou `"alert"`) estava na linha da lista (`<li>`), o que **quebra a lista** para o leitor. O papel foi para o texto de dentro.
- O atalho para o outro lado (fome ↔ trabalho) não estava em nenhum ponto de referência; agora é uma região com nome ("Outro caminho").
- O código de entrega (os quatro dígitos grandes) era lido dígito por dígito, sem contexto; agora é lido pelo nome falado.
- "Informações do restaurante" e "Chamar o atendente" tinham nome, mas numa caixa sem papel, e o leitor ignora esse nome. Agora são grupos (`role="group"`). Foi o teste de regras que achou, não o leitor automático.

**Letra grande (quem aumentou o texto do celular):**

- As abas do painel saíam da tela; agora descem de linha, com o número embaixo do nome.
- Linhas de conta ("nome … valor"), o total do dia, os passos, as três células do Hoje, o cabeçalho da lista de pratos e as mensagens (erro, aviso, dica, vazio) agora **quebram a palavra** em vez de sair da tela ou cortar um e-mail ou número comprido.

**Defeitos que só a foto da tela mostrou** (o leitor automático não vê): hora cortada ("11:00 A") no Horário em celular de 320 e 360 px; o botão de tirar o turno foi para a linha dele, com o nome escrito.

## O que ainda **só um celular de verdade** responde

Não dá para medir de longe: como o TalkBack e o VoiceOver leem cada tela, o que o microfone do aparelho entende, o seletor de hora de cada celular, o teclado cobrindo botões, o sol forte, a mão molhada, o aparelho simples. A lista com o que olhar e como me contar está em `docs/teste-no-celular.md`, seção "Fica para depois".

## Comandos de voz

Voz também é acessibilidade (quem lê pouco fala o que quer). O roteiro de tudo o que dá para falar, por função, está em `docs/comandos-de-voz.md`, gerado do código e conferido por `tests/novo/comandosDeVoz.test.mjs`.

## Regras que a equipe segue daqui para frente

1. Tela nova entra na página de conferência (`preview.tsx`); a medição pega as telas dela sozinha.
2. Antes de juntar, rodar `tests/navegador/acessibilidade/rodar.sh`. Defeito novo vira regra no teste que roda no GitHub quando der para escrever como regra.
3. Botão de 44 px ou mais; foco visível; nenhuma informação só por cor; nenhuma mensagem só em som ou só em vibração.
4. Aviso que muda sozinho (pedido novo, erro, salvo) vai em uma região que já existia na página, com `role="status"` (calmo) ou `role="alert"` (urgente), no texto, nunca na linha da lista.
5. `aria-label` só em quem pode ter nome: botão, campo, região, lista, item de lista, grupo. Caixa solta (`<div>`, `<span>`, `<p>`) precisa de `role` junto.
6. Texto que pode ser comprido (nome do prato, e-mail, endereço, valor) tem que poder quebrar.
