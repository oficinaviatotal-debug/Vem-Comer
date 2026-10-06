# Vem Trabalhar: método (matching, cursos próprios, informal)

Resumo do que o dono (GD) definiu em 06/10/2026 e do que está em `docs/planilhas/Vem-Trabalhar-planilhas.xlsx`.
A planilha é a fonte dos números e das listas; este texto é o caminho para o código.

## Quem é o público

Milhões de pessoas no mercado informal que hoje só enxergam vaga em páginas do Instagram e não têm onde
criar currículo, se cadastrar, se avaliar, estudar e ser encontradas. O produto serve do autônomo
(1 pessoa) à empresa de mil funcionários, com o mesmo método e as mesmas telas.

Regra de produto: tudo de toque ou voz, nada de digitar; funciona em 2G a 5G; sem exigir site do governo.

## Matching: 20 + 20 perguntas

Cada pergunta do candidato tem uma gêmea na vaga (aba `Matching`). Cada par tem regra de comparação
(nota de 0 a 1) e peso (1 a 5). Nota final = soma(peso x nota) / soma(pesos que se aplicam).

- Filtro do candidato: o "não" que a pessoa marcou esconde a vaga da lista dela. Quem decide é ela.
- Obrigatória (a empresa marca até 3): mostra o aviso "não atende"; a empresa decide. Nada é descartado sozinho.
- A pessoa vê a nota, os 3 pares que mais tiraram pontos e o curso que melhoraria cada um.
- Fora do match, sempre: raça, religião, estado civil, filhos, idade, foto, saúde.
- O teste de perfil só entra se a pessoa autorizar e a empresa pedir. Nunca elimina.

Geografia (aba `Geografia`): casa, trabalho e local de estudo; distância em linha reta x fator de rua +
espera do meio de transporte; curso EAD nunca perde ponto por distância. Coordenada guardada
arredondada (cerca de 500 m). As velocidades são premissas, a calibrar. Converter CEP em coordenada
usa a mesma peça da entrega por CEP do Vem Comer.

## Cursos

- Só cursos livres são nossos: lições de 5 a 8 minutos, atividade de toque, reteste, prova final com nota mínima
  de 70% que dá certificado e nunca elimina. Rascunho por IA, revisão humana antes de publicar.
- Catálogos de terceiros (Sebrae, Fundação Bradesco, Sistema S etc.) e os dados regionais do IBGE ficam fora
  (decisão do GD, 06/10/2026). A primeira versão da planilha, com esse levantamento, continua no histórico do git
  (commit de51e17).
- Curso técnico e faculdade entram por parceria: a escola paga ao Vem Trabalhar 50% da matrícula e 30% de cada
  mensalidade (entendimento da fala do GD; falta confirmar por quantas mensalidades e se vale igual para
  técnico e faculdade). O aluno paga o preço normal da escola.
- Curso de parceiro leva a etiqueta "Parceiro". A comissão nunca muda a nota do match nem a ordem das vagas.
- Certificado é de curso livre. Diploma técnico ou superior só instituição credenciada emite: o Vem Trabalhar
  faz o link, o aluno e o match. Conferir credenciamento antes de fechar com a escola.
- Curso livre não precisa de MEC (palavra do GD); confirmar com advogado antes de abrir.

## O que ainda falta decidir

Veja a aba `Leia primeiro`: prazo da comissão de 30%, quais escolas e faculdades, meta de 200 cursos (no total ou
por região), R$ 80 mensal ou único, currículo básico grátis, a metodologia de gestão dos 25 anos do GD, revisão do advogado.

## Limites

Nenhuma escola foi contatada; as abas de parceiros têm só um exemplo inventado e a linha do Centec, citado pelo GD.
Os pesos, as velocidades e as notas de leitura automática (ATS) são premissas nossas.
As frases do teste de perfil são traduções nossas do IPIP (domínio público) e pedem revisão de psicólogo.
