# Navegação por função e conversa com os dois lados

Desenho e estado de 15/10/2026, a partir das falas do GD de 06:10 e 06:13 (itens 70 a 73 de
`docs/requisitos-do-dono-vem-comer.md`). Este arquivo diz **o que já está no código**, **o que é só desenho** e
**o que depende do GD**. Onde não sei, está escrito que não sei.

## 1. O que o GD pediu

1. A tela inicial do painel não deve começar em "criar cardápio". As funções ficam num **menu de três tracinhos
   do lado esquerdo**; a tela principal mostra **as atividades**.
2. O **link do cliente** abre **direto no cardápio**.
3. Quem trabalha (cozinha, motoqueiro, garçom, caixa, dono) entra por uma **tela inicial com um botão por função**.
   O garçom vai **direto à mesa**, lendo o QR Code.
4. A IA conversa com **os dois lados** (currículo e vaga) e a redução de custo vem de tudo ser automatizado.

## 2. Benchmark "Viver de IA" (agente "Nina")

O GD mandou o texto de um anúncio: um agente de IA que atende e liga pelo WhatsApp e agenda com o time, com a
promessa de "150 soluções".

- **O que o anúncio promete não foi verificado** (número de soluções, resultados, preço). Serve como referência de
  forma, não como prova de que funciona.
- O que levamos dele: o agente pode viver **dentro do WhatsApp, do Instagram e do ecossistema**. No nosso desenho,
  a conversa acontece no portal (portal primeiro) e o WhatsApp e o Instagram **trazem** a pessoa e **avisam**.
- Regras que continuam valendo para qualquer agente nosso: diz que é um assistente; **preço, salário e prazo vêm do
  banco e nunca da IA**; quando não sabe, diz "vou confirmar com a casa"; ação de alto impacto precisa do aval do
  dono do software (GD) ou do dono do restaurante.

## 3. Como as pessoas entram (no código desde esta entrega)

| Quem | Por onde entra | O que vê primeiro |
|---|---|---|
| Cliente na mesa | QR da mesa (`?empresa=…&mesa=…`) | A tela da mesa (chamar garçom, pedir a conta, ver o cardápio) |
| Cliente sem mesa | Link do restaurante (`?empresa=…`) | **O cardápio, direto** |
| Cozinha, garçom, caixa, entregador | Endereço sem restaurante → botão da função → entrada (`?entrar=1&funcao=…`) | A entrada com o título da função; depois, a tela "Hoje" da função |
| Dono e gerente | Botão "Entrar no painel" | "Hoje": pedidos por etapa, vendas e avisos, e o menu |
| Já entrou antes | Qualquer endereço, com o restaurante lembrado | Direto no painel |

Todo botão de função leva à **mesma entrada**: quem decide o que abre é o **cadastro da pessoa**, não o botão.
Escolher "Cozinha" sendo garçom não dá acesso a nada que não seja dela.

## 4. O painel agora

- **Hoje** (primeira tela): saudação, os cartões do que está acontecendo (novos, na cozinha, entregas, Pix a
  conferir, conforme a função), vendas de hoje e avisos (só dono e gerente) e os botões grandes do que a função mais faz.
  Nada é estimado: os cartões contam os pedidos que o painel já busca; vendas e avisos vêm dos mesmos números de
  "Seu negócio".
- **Menu de três tracinhos** (esquerda), em grupos: Vender, Cardápio, Números, Minha loja (e Plataforma, só para quem
  administra a plataforma). Cada função só vê as telas que já via antes; há teste que compara a lista antiga com a nova.
- Plano vencido: o menu continua mostrando só o que já era permitido (Pedidos, Entregas, Acerto de caixa e Plano).
- O **guia passo a passo** abre e fecha o menu sozinho nos passos que apontam para uma tela dentro dele.

### Decisão que é do GD

O QR da **mesa** abre hoje a tela da mesa (item 57: chamar garçom, pedir a conta, ver o cardápio). O pedido do GD fala
em abrir **direto no cardápio**. As duas coisas cabem juntas se o cardápio abrir primeiro e a tela da mesa virar um
botão fixo "Chamar o garçom" dentro dele. **Não mexi nisso sem a resposta do GD.**

## 5. O que ainda falta nesta parte

- **Ler o QR da mesa dentro do aplicativo** (garçom). O navegador tem leitor de código nativo em alguns aparelhos e
  em outros não (no iPhone a compatibilidade é limitada); por isso o desenho é leitor + **campo para digitar o número
  da mesa** como saída segura. Ainda não está programado.
- **Modo garçom completo** (item 65): mesas por garçom, assumir a mesa pelo QR ou pelo número, ticket da mesa.
- Telas de dentro do painel (Pedidos, Produtos etc.) **não foram redesenhadas**; só mudou a forma de chegar nelas.
  O GD ainda vai olhar as outras telas.

## 6. Conversa com os dois lados (desenho; **nada disto roda ainda**)

### O que existe de verdade hoje

- **Vem Comer:** assistente do cardápio por voz, foto e planilha. A leitura de foto e PDF depende da **chave de
  IA no servidor**, que ainda não está instalada; sem ela, o que funciona é voz e planilha.
- **Vem Trabalhar:** vitrine, banco novo e API de cadastro (em PRs, nada instalado) e uma função de voz que só
  reconhece a frase. **Não há conversa que monte o currículo nem a vaga em código.**
- O desenho do currículo (38 etapas) e a lista de cursos estão em `docs/curriculo-ia-e-voz.md`.
  O GD tem razão: estamos **longe do ideal**; o volume de desenho é grande e o de código é pequeno.

### Um motor de conversa só, para currículo e vaga

Em vez de um formulário por tela, **um motor** que serve aos dois lados:

1. **Entra por voz, texto ou foto** (foto do currículo velho ou da vaga em papel).
2. **Lê o que veio** e monta um rascunho com o que entendeu. O que não entendeu fica marcado com "?".
3. **Pergunta só o que falta**, uma pergunta por vez, com resposta de tocar ou falar.
4. **Mostra o que entendeu** e a pessoa **confirma cada trecho com um toque**. A IA nunca escreve o que a pessoa não disse.
5. **Fecha** num modelo de currículo ou de vaga saudável e padronizado.

Regras que não mudam: diz que é assistente; **não escreve preço nem salário** (a empresa informa, ou o sistema mostra
a faixa do banco); não pergunta idade, estado civil, filhos, saúde, religião nem cor; áudio e foto de currículo são
**dado pessoal** (LGPD): consentimento claro, apagar o áudio depois de virar texto e direito de excluir (ver
`docs/direitos-do-titular.md`); decisão final de contratar é sempre humana.

### Perguntas do lado do candidato (resumo; a lista completa está em `curriculo-ia-e-voz.md`)

- Por experiência: lugar, função, início e fim, **o que fazia no dia a dia (atividades)**, ferramentas, quem atendia,
  resultado, o que aprendeu. Quem nunca trabalhou conta bico, ajuda na família e voluntariado.
- Para a **análise de perfil**: as atividades e os resultados que a pessoa contou, não suposições do sistema.
  Todo ponto da análise mostra de qual resposta veio.

### Perguntas do lado da empresa, ao cadastrar a vaga (rascunho)

O GD pediu perguntar "o que fazer, como fazer, quando fazer" e o resto das condições:

1. **A função:** o que a pessoa vai fazer no dia a dia; como se faz bem; que resultado se espera; que qualidade é a esperada.
2. **Quando e onde:** dias e horários (turnos, fim de semana, feriado); local; se há deslocamento, viagem ou trabalho externo.
3. **Disponibilidade:** quando começa; se é temporário, fixo ou por diária.
4. **Condições:** **remuneração e benefícios** (informados pela empresa, nunca inventados); forma de contratação.
5. **O que é exigido de verdade:** habilidades e ferramentas obrigatórias separadas das desejáveis (isso alimenta o match).

Do lado do candidato, as mesmas dimensões voltam como pergunta ("em que horários você pode?", "aceita viajar?"), para
o match comparar **respostas com requisitos** e explicar o porquê.

## 7. Próximos passos, em ordem

1. O GD ver o painel novo no celular e dizer o que ajustar (incluindo a decisão do QR da mesa).
2. Leitor de QR no aplicativo com campo para número da mesa + modo garçom (item 65).
3. **Chave de IA no servidor** (por script, nunca colada em conversa) para o assistente de cardápio ler foto e PDF.
4. Motor de conversa, começando pela **vaga** (campos fechados, valor vem da empresa) e depois pelo **currículo**.
5. Só depois, conectar WhatsApp e Instagram como porta de entrada e aviso.

## 8. O que depende do GD

- Ver as telas novas e aprovar ou pedir ajuste (nada foi aberto ao público).
- Decidir se o QR da mesa abre direto no cardápio.
- Senha da chave de acesso ao servidor, chave de IA (por script), domínio e e-mail do sistema, CNPJ e endereço,
  encarregado de dados, advogado e contador: ver as pendências em `docs/requisitos-do-dono-vem-comer.md`.
