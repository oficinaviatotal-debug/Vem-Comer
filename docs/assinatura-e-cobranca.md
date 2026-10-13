# Assinatura, teste grátis e cobrança

Decisões do GD em 06/10/2026. O que ainda está aberto está no fim.

## Vem Trabalhar: quanto custa

**Candidato** (quem procura emprego, estágio, troca de emprego): **R$ 80** do próprio bolso. Dá direito a criar, melhorar e
potencializar o currículo, com **20 ou mais modelos** (cores, layouts) e os **testes de perfil e de habilidades**.

**Empresa**: paga **por mês, pela quantidade de vagas anunciadas**. Dá acesso aos currículos cadastrados e ao match.

| Vagas anunciadas | Por mês |
|---|---|
| 0 a 10 | R$ 300 |
| 11 a 500 (o GD citou 11 a 50 e 51 a 500, os dois a R$ 500: é uma faixa só) | R$ 500 |
| 501 a 1.000 | R$ 1.000 |
| Acima de 1.000 | Negociado |

Estes preços **substituem** os antigos (candidato R$ 15; empresa com 2 vagas grátis e de R$ 100 a R$ 400).

## Teste grátis

- **Uma semana**, para quem se cadastra (candidato e empresa), **sem poder baixar nada**: nem o currículo em arquivo, nem a
  lista de candidatos. Dá para usar e ver; baixar depende de assinar.
- Objetivo do GD: formar o **banco de dados** e juntar informações para o **marketing**. Isso só vale com cadastro feito pela
  própria pessoa e **consentimento claro** para e-mail, WhatsApp e Telegram, com como sair (LGPD). Nada de lista comprada
  nem de coleta de dados atrás de login de terceiros.

## Vem Comer (restaurante)

Preço inicial (GD, 07/10/2026): **R$ 190 por restaurante por mês**, só pelo uso da plataforma, **pago no primeiro dia** para começar a usar (sem semana grátis). O restaurante cobra os clientes dele; o GD
não cobra venda nem fica com parte do dinheiro dele. Vence no dia do mês em que o restaurante entrou, e **quem não paga bloqueia no dia
seguinte** (entrou dia 5, vence todo dia 5, no dia 6 não funciona). Estratégia de entrada: ser a opção mais barata nos 3 primeiros meses
e subir o preço aos poucos para os próximos que entrarem. Detalhes e proposta de engenharia no item 66 de
`docs/requisitos-do-dono-vem-comer.md`. Falta decidir o preço de lançamento dos 3 primeiros meses e a política de devolução.

## Vem Comer: o que já está construído (13/10/2026)

Cobrança **manual primeiro**: o GD recebe o Pix e registra no painel. A cobrança automática espera a escolha da empresa de
pagamento (veja "Em aberto"). Tudo abaixo vem **desligado**: o painel mostra o plano e os avisos, mas **nada bloqueia**
até o GD ligar.

**Regras (todas no servidor, `backend/subscription.py`; o celular só mostra)**

- Plano único `vemcomer_mensal`, R$ 190,00. O preço fica **copiado na assinatura de cada restaurante**: quem entrou
  mais barato mantém o preço quando o preço de tabela subir (item 66).
- Quem se cadastra pela internet nasce **esperando o 1º pagamento**. Restaurante **sem assinatura** (os de teste e os que o
  próprio GD criou antes) **nunca é bloqueado**.
- O 1º pagamento vale desde o dia em que o GD o registra; esse dia vira o **dia do vencimento** de todo mês (quem pagou dia
  29, 30 ou 31 vence no último dia do mês mais curto). Venceu dia 5, no dia 6 não funciona.
- Aviso **3 dias antes** e **no dia**, no painel do dono (faixa no alto) e na lista do GD.
- A situação **não fica gravada**: sai da data de hoje (horário de Brasília) e do último dia pago. Não existe tarefa diária que
  possa parar de rodar e deixar alguém bloqueado ou liberado por engano.
- Pagar adiantado continua de onde o período terminava, sem perder nem um dia. Pagar **depois de vencido** começa um mês
  cheio **a partir do dia do pagamento**, e o dia do vencimento passa a ser esse (quem ficou fora não paga os meses
  parados).
- Toque duplo não paga dois meses: um segundo registro para o mesmo restaurante em menos de 30 segundos é recusado (erro 409).
  Dois toques ao mesmo tempo também: um passa e o outro é recusado (testado com banco de verdade). Pagar de novo depois disso,
  de propósito, adianta mais um mês.

**O que "bloqueado" faz (só com a cobrança ligada)**

- O cliente vê o cardápio, mas o botão de pedir some e aparece "Sem pedidos agora". O servidor também recusa o pedido novo
  (erro 403 `not_accepting_orders`), então não adianta mexer no celular.
- Pedidos que já estavam em andamento **terminam** normalmente. **Nada é apagado.** Volta **na hora** em que o pagamento é
  registrado.
- O painel do dono só mostra **Pedidos** (para terminar o que está andando) e **Plano** (para pagar). As outras telas voltam
  quando paga. Essa trava de telas é **do aplicativo**; quem trava de verdade, no servidor, é o **pedido novo**. (Trancar
  também as rotas de cardápio e relatórios no servidor fica para quando a cobrança automática existir.)

**Telas**

- **Dono, aba Plano**: situação ("Em dia até 05/11", "Vence em 3 dias", "Venceu em 05/10", "Falta o 1º pagamento"), valor, a
  chave Pix com botão "Copiar chave Pix", os botões "Já paguei: mandar comprovante" e "Falar com o suporte" (abrem o WhatsApp do GD com a
  mensagem pronta; aparecem quando falta pagar ou o vencimento está perto) e o histórico de pagamentos. Restaurante sem plano não tem a aba.
- **GD, aba Assinaturas** (só aparece para e-mail de administrador): todos os restaurantes, filtro "só quem pede atenção",
  busca, botão **Cobrar no WhatsApp** (abre a conversa com o dono, mensagem pronta e educada) e **Registrar pagamento** (valor já preenchido,
  forma e anotação).

**Como ligar (comandos do servidor, só o GD)**

```
# 1) dizer quem é o administrador e para onde vai o dinheiro (qualquer parte, em qualquer ordem)
bash /opt/vem-comer/app/deploy/vps/cobranca.sh dados --admin SEU@EMAIL --pix "SUA CHAVE PIX" --recebedor "NOME" --whatsapp 5584999999999

# 2) ver como está
bash /opt/vem-comer/app/deploy/vps/cobranca.sh status

# 3) ligar (pede para digitar a palavra "ligar") e, se quiser, desligar
bash /opt/vem-comer/app/deploy/vps/cobranca.sh ligar
bash /opt/vem-comer/app/deploy/vps/cobranca.sh desligar
```

O script só mexe em linhas do arquivo `.env`, reinicia só o servidor do Vem Comer (alguns segundos fora do ar) e não toca
no banco. Recusa ligar sem administrador ou sem forma de pagar (o dono bloqueado precisaria saber para onde pagar). Valores com
aspas, cifrão, barra, crase ou `#` são recusados, porque estragariam o arquivo.

| Variável | Para quê |
|---|---|
| `BILLING_ENFORCED` | `1` liga o bloqueio. Vazio ou ausente: desligado (padrão). |
| `PLATFORM_ADMIN_EMAILS` | E-mails (separados por vírgula) que veem todos os restaurantes e registram pagamentos. |
| `BILLING_PIX_KEY`, `BILLING_PIX_RECEIVER` | Chave Pix e nome de quem recebe, mostrados ao dono. |
| `BILLING_CONTACT_PHONE` | WhatsApp para o dono pedir ajuda ou avisar que pagou. |

A chave Pix e os dados de contato vêm do **servidor**, nunca do navegador. Não há chave de empresa de pagamento nenhuma ainda.

**Rotas**

- `GET /api/admin/subscription`: o plano do dono logado (situação, vencimento, mensagem, forma de pagar, histórico).
- `GET /api/platform/subscriptions` e `POST /api/platform/subscriptions/<id>/payments`: só administrador da plataforma (o
  e-mail vem do banco, a partir do login, não do que o navegador diz). Quem não é administrador recebe 403 "Acesso negado".
- A listagem pública do restaurante passa a dizer `accepting_orders` (o cardápio usa para trocar o botão).

**Testes**: regras (`test_subscription.py`, 42), rotas (`test_subscription_endpoint.py`, 39), tela
(`tests/ui/subscriptionView.test.mjs`) e script de ligar/desligar (`deploy/vps/test_cobranca.py`, 22, rodado à mão como o do
cadastro). O fluxo inteiro (cadastro, 1º pagamento, vencimento, bloqueio, pagamento depois de vencido, dois pagamentos ao mesmo
tempo) foi rodado contra um PostgreSQL 16 de verdade com as migrações 002 a 012.

## Cobrança por Pix: como vai ser

- O dinheiro entra por Pix. Para o sistema saber **sozinho** quem pagou, é preciso um prestador de pagamento (PSP) que
  avise o servidor a cada pagamento (webhook). Conferir à mão não aguenta mais que poucos clientes.
- Existe o **Pix Automático**: a pessoa autoriza uma vez no app do banco e os meses seguintes são cobrados sozinhos; o
  primeiro QR Code já vale como primeiro pagamento mais a autorização. O Asaas documenta isso
  (https://docs.asaas.com/docs/pix-automatico). Não foi possível ler as taxas nem se aceita CPF ou só CNPJ; isso se
  confirma ao abrir a conta.
- Plano de partida: **QR Pix mensal comum** (funciona em qualquer banco) com aviso de vencimento; **Pix Automático** como
  melhoria, para quem o banco permitir.
- O servidor nunca guarda dado de cartão nem chave do PSP no navegador; a chave do PSP entra só pelo script do servidor
  (entrada escondida), como a chave de IA.

## Como será construído (proposta de engenharia)

- Mesmo servidor e mesmo login do Vem Comer, com **tabelas separadas** para os dados de cada produto
  (requisito 26: uma pessoa, vários papéis). O repositório atual do Vem Trabalhar fica só como vitrine.
- Tabelas: `plans` (faixas e preços, dados e não código), `subscriptions` (produto, situação, fim do teste, fim do
  período), `payments` (referência, valor, situação, id no PSP, pago em).
- Situações: `trial`, `active`, `past_due`, `canceled`. Uma única função diz o que cada situação pode fazer; "baixar"
  fica bloqueado em `trial`.
- A faixa da empresa vem das vagas **ativas ao mesmo tempo**; ao chegar no limite da faixa, a tela oferece subir de plano
  antes de publicar mais uma.
- Webhook do PSP: assinatura conferida, sem processar duas vezes o mesmo aviso, e só muda a situação depois de conferir o
  valor com o plano.

## Em aberto

1. O R$ 80 do candidato é **por mês** ou pago **uma vez**? (o GD falou em "acessos mensais"; tratado como mensal até dizer o contrário)
2. O currículo **básico por voz, vídeo ou foto** para quem nunca trabalhou continua **grátis** (requisito 35) e os R$ 80 são
   do pacote completo, ou tudo é pago?
3. Preço de lançamento do **Vem Comer** nos 3 primeiros meses (o preço inicial é R$ 190, pago no primeiro dia) e a política de devolução.
4. Qual **CNPJ** recebe e qual **PSP** (taxas, CPF ou CNPJ).
5. O que precisa estar funcionando em **13/10**.
6. **Pagamento atrasado**: hoje, quem paga depois de vencido começa um mês cheio a partir do dia do pagamento e o dia do
   vencimento muda para esse dia. Alternativa: manter o dia original e cobrar proporcional. Qual o GD prefere?
7. **Bloqueio no servidor**: hoje o servidor recusa só o **pedido novo**; as outras telas do painel são travadas pelo
   aplicativo. Se o GD quiser que o servidor recuse também cardápio e relatórios de quem está bloqueado, é uma segunda etapa.

## Receita de parcerias com escolas (decisão do GD, 06/10/2026)

Além das assinaturas, o Vem Trabalhar recebe das escolas parceiras (técnicas e faculdades): 50% da matrícula e
30% de cada mensalidade dos alunos que levar. O aluno paga o preço normal da escola. Por quantas mensalidades a
comissão vale está em aberto. Referência de mercado: o anúncio de parceiros da Uniateneu (06/10/2026) fala em até 100% da matrícula e até 70% das mensalidades; nossos 50% e 30% são piso para negociar. Detalhes e calculadora em `docs/planilhas/Vem-Trabalhar-planilhas.xlsx` (aba `Parcerias`).
No código, a comissão fica fora do match e fora da ordem das vagas; o curso de parceiro leva a etiqueta "Parceiro".

## Receita do RH terceirizado (pedido do GD, 06/10/2026)

- Taxa do profissional de RH para se cadastrar: R$ 200 (em aberto: uma vez ou por mês).
- Cada RH define o preço da entrevista; o Vem Trabalhar fica com 30% de cada entrevista paga pela plataforma.
  Exemplo da planilha (valores inventados): entrevista de R$ 150 → R$ 45 para o Vem Trabalhar e R$ 105 para o RH.
- Precisa de meio de pagamento com divisão automática (split) para o repasse de 70%; até lá, repasse manual com registro.
- Calculadora na aba `RH parceiro` de `docs/planilhas/Vem-Trabalhar-planilhas.xlsx`.
