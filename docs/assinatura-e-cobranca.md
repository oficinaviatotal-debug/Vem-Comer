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
