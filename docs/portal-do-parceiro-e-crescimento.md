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
