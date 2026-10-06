# Portal do parceiro, banco de pessoas vivo e sistema vivo

Pedidos do dono (GD) de 06/10/2026. Detalhes nas abas `Portal do parceiro`, `Canais` e `Sistema vivo` de
`docs/planilhas/Vem-Trabalhar-planilhas.xlsx`.

## Portal do parceiro

Cada escola ou faculdade entra por um link, se cadastra sozinha, cadastra os próprios cursos e as empresas que
contratam seus alunos, e aparece na tela de cursos do aluno, depois dos cursos livres que cobrem a mesma
habilidade, com a etiqueta "Parceiro".

Proposta de dados (a desenhar junto do código): `partners` (instituição, CNPJ, contrato aceito, situação da
conferência), `partner_courses` (tipo, modalidade, CEP, preço, vagas, início, link), `partner_leads` (interesse e
consentimento do aluno), `partner_enrollments` (matrícula confirmada pelas duas pontas), `partner_commissions`
(50% da matrícula e 30% de cada mensalidade paga; extrato; pagamento por Pix). Papel novo `PARTNER`, isolado por
instituição como os demais papéis são isolados por empresa.

Regras: a comissão não entra na nota do match nem na ordem; a escola recebe só contato de quem tocou em "tenho
interesse" e autorizou; contrato com auditoria, prazo de pagamento e multa, revisado por advogado; conferir o
credenciamento antes de publicar.

## Banco de pessoas vivo

14 canais de entrada e de contato diário (QR nos restaurantes do Vem Comer, link nas páginas de vagas do
Instagram, WhatsApp com aceite, notificação do app, e-mail, SMS, currículo em PDF com link, indicação, páginas
públicas, lição do dia, convites de escolas e de empresas, vídeos curtos, áudio no WhatsApp). Para o RC de 13/10
estão prontos sem muito código: QR nos restaurantes, link nas páginas do Instagram e vídeos curtos; parcialmente:
WhatsApp (entrada), e-mail (coleta) e convite de parceiros.

Regra de ouro: só entra no banco quem aceitou. Nada de lista comprada, nada de raspar Instagram, nada de
mensagem fora do aceite (LGPD; regras do WhatsApp). Custos de WhatsApp, SMS e e-mail ainda não verificados.

## Sistema vivo

Agentes que propõem melhoria (benchmark semanal, cursos, vídeos, qualidade do match, comunicação, parcerias,
privacidade, saúde do sistema, currículos). Eles propõem; pessoas decidem. Mudança de código vai por pull request
com testes e aceite do dono. Cada agente com teto de custo por mês (a definir).

## Páginas de vagas do Instagram: parceria, não coleta (fala do GD, 06/10/2026)

O GD mostrou posts reais de páginas de vagas de Natal e região (chapeiro, recepcionista, vendedor interno, manicure):
cada empresa sem RH faz a própria arte e põe e-mail ou WhatsApp; páginas de vagas repostam; o candidato procura em
centenas de páginas.

Decisão de engenharia: **não** coletar automaticamente e-mails e WhatsApps desses posts para mandar mensagem em massa.
Os termos da Meta proíbem coletar dados do Instagram por meios automáticos sem permissão; a LGPD diz que dado público
só pode ser usado conforme a finalidade para a qual foi publicado (art. 7º, § 3º), e o contato do post foi publicado para
receber currículo, não propaganda; o WhatsApp bloqueia números que mandam mensagem a quem não pediu; e contraria a regra
de ouro deste documento. O advogado confere.

O que fazemos no lugar, para crescer em volume:

1. **Vaga por foto**: a empresa manda a foto da arte que já faz (como os posts do GD) e o sistema monta a vaga: cargo,
   requisitos, horário, bairros, atividades, benefícios. Mesma peça do cardápio por foto. Os 4 posts são casos de teste.
2. **Post automático**: de cada vaga sai a arte pronta para Instagram e WhatsApp, com o selo "vaga verificada" e um QR
   para se candidatar no Vem Trabalhar (benchmark V4: uma ideia vira 10 formatos).
3. **Páginas de vagas como parceiras**: cada página ganha um link com código; o candidato se candidata em 1 toque; a página
   recebe comissão quando a empresa que ela trouxe assina. Elas viram canal, com aceite.
4. **Vaga verificada e candidato verificado**: empresa confere CNPJ ou documento; vaga com salário ou faixa; selo contra
   golpe de vaga falsa. Diferencial frente aos posts soltos.
5. **Google**: cada vaga vira uma página pública com a marcação de vaga do Google (JobPosting), que aparece na busca de
   empregos do Google; a Google diz que o recurso está disponível em toda a América Latina.
6. **Contato com a empresa que postou**: só uma pessoa, uma mensagem, pelo canal que a empresa publicou, se apresentando e
   oferecendo publicar a vaga de graça; "não" encerra o contato. Sem robô, sem lista.
7. **Vem Comer**: cada restaurante do Vem Comer publica as vagas dele no Vem Trabalhar sem custo, e o QR da mesa leva
   candidatos e clientes; páginas de comida da cidade entram no mesmo modelo de parceria das páginas de vagas.

