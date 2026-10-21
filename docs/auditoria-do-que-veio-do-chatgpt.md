# Auditoria: o que veio do ChatGPT (e de outras mãos), e o que a prova mostra

Feita em 21/10/2026, por pedido do GD (16/10), que desconfia de "engenharia pronta" do ChatGPT. Regra desta página:
cada item diz **de onde veio**, **que prova existe** e **o que proponho**. Onde não consegui ver, está escrito que não vi.

Como li "veio do ChatGPT": são os commits feitos pela conta `oficinaviatotal-debug` do GD no começo de outubro de 2026, com
mensagens em inglês (`feat: add MVP...`). É uma **inferência**: a conta também faz os merges do próprio GD.

## Quem escreveu os 458 arquivos que estão hoje na `main` do Vem Comer

Conta feita pela API do GitHub: para cada arquivo de hoje, quem mexeu nele em algum momento (292 alterações, sem
merges).

| Quem mexeu | Arquivos |
|---|---|
| Só o Claude | 400 |
| Só a conta do GD (ChatGPT, por inferência) | 23 |
| Só `luccanathaz` | 16 |
| Claude e `luccanathaz` | 6 |
| `luccanathaz` e a conta do GD | 5 |
| Os três | 5 |
| Claude e a conta do GD | 3 |

## 1. A base do repositório não é do ChatGPT nem minha: é de `luccanathaz`

- O repositório tem **102 alterações de `luccanathaz`, de 30/08 a 23/09/2026**, antes de qualquer coisa minha ou do ChatGPT.
- Sobrevive: a estrutura de pastas, o banco (`database/schema.production.sql`, 528 linhas, **usado de verdade** pelo
  instalador e pelos testes), a primeira versão do servidor (`backend/app.py`, hoje **5.431 linhas em um arquivo só**),
  do painel (`AdminPanel.tsx`, **1.958 linhas**), de `api.ts` e do `styles.css`. Eu ampliei esses arquivos; não os reescrevi.
- Um arquivo de registro (`frontend/logfile`) e quatro scripts vazios (`Scripts/*.sh`) ficaram no repositório.
- **Pergunta ao GD:** quem é `luccanathaz`? O `LICENSE` diz que tudo é do GD. Se for gente de fora, é preciso um papel
  de cessão. **Não sei** quem é e não presumi.
- Consequência técnica: o front-end que o GD chamou de "arcaico" nasceu aí (painel único de 1.958 linhas). O que mudei
  (menu, tela Hoje) foi por cima.

## 2. O código do ChatGPT que está no Vem Comer

| Arquivo | O que é | Prova | Proposta |
|---|---|---|---|
| `backend/mvp_payment.py` (116 linhas) e `test_mvp_payment.py` | Pagamento de mentira (`MockPSP`) para testes | **Nenhum arquivo do servidor o chama.** Só o próprio teste. | Retirar, em PR pequeno, se o GD concordar |
| `backend/tenant_policy.py` (33 linhas) e seu teste | Regra de isolamento entre restaurantes | **Também não é chamado pelo servidor.** O isolamento de verdade está em `app.py`; vários testes de endpoint (pedidos, Pix, logomarca, entrega e outros) tentam alcançar dados de outro restaurante | Retirar, junto com o item acima |
| `backend/table_qr.py` (26 linhas) | Gera a imagem do QR da mesa | Usado por `app.py` | Manter |
| `frontend/src/voice/VoiceCommandButton.tsx` e `voiceCommand.ts` | Botão de voz do cardápio | Usado em `CustomerApp.tsx`. Só reconhece frases; **não conversa** | Manter por ora; a conversa de verdade é refazer |
| `supabase/functions/vemcomer-voice-command` | Função de voz para o Supabase | O Supabase não roda o sistema | Retirar |
| `.github/workflows/security.yml`, `gitleaks.yml`, `mvp-security.yml` e `tests/security/frontend-xss.test.mjs` | Segurança automática | Rodam a cada PR | Manter |
| `docs/LIVING_SYSTEM_SPINE.md`, `docs/BENCHMARK_INTELLIGENCE.md` | Listas de princípios ("sistema vivo", 12 etapas) | **Não há código que cumpra o laço.** Hoje só existe a fila de Aprovações, sem nenhum robô propondo cartões | Tratar como desenho, não como entrega |

## 3. Vem Trabalhar (repositório privado)

- **17 funções do Supabase**, somando ~60 KB, versionadas pela conta do GD em 02/10. Todas falam com o banco `linkjob`
  do Supabase. Três dizem no próprio código `simulation_only`, `live_capture: "not_claimed"` ou `real_capture_added: 0`:
  **declaram o que fariam, sem fazer**. As duas maiores (`linkjob-automation`, 11 KB, que lê páginas públicas de vagas, e
  `owner-programmer`, 7 KB, que classifica pedidos do dono por palavras-chave) são código de verdade, mas dependem do Supabase.
- O projeto **LinkJob do Supabase está pausado** (status `INACTIVE`) e o GD decidiu em 14/10 que o banco do Vem
  Trabalhar fica na VPS. Logo, **nenhuma das 17 funções roda hoje**.
- Proposta: **não portar nada**. Servem de lista de ideias; o Vem Trabalhar novo nasce no mesmo servidor do Vem Comer.
- O que o Claude escreveu e tem teste: `backend/parceria.py` e `documento.py` (parceria com escolas e CPF/CNPJ). A vitrine
  em `src/` tem uma **base do ChatGPT** (3 commits `add Vem Trabalhar executable foundation`) e a marca azul e os
  templates feitos pelo Claude por cima.

## 4. Supabase (lido hoje, só leitura)

- Três projetos: dois **pausados** (`LinkJob` e um projeto sem nome do e-mail do GD) e um **ativo**: `IPEDI — Modo
  Deus`, com **6 funções `vemcomer-*`** (voz, sincronia com o LinkJob, índice do programa e três versões de "evolução contínua").
- **Não consegui ler as tabelas** (o Supabase recusou a senha de leitura). Portanto **não sei se há dados reais** lá.
  Não tentei contornar.
- Em 05/10 o GD me mostrou um aviso: os projetos seriam restringidos a partir de **02/11/2026** se a cota continuar
  estourada. Convém decidir antes disso se algo ali precisa ser exportado.

## 5. O servidor da VPS

- O instalador do Vem Comer foi escrito para **não mexer** em `/opt/vem-tecnologia` ("runtime da ChatGPT") nem em
  `/var/backups/vem-audit`. **Eu nunca vi o que há dentro.** Não sei se está rodando, o que faz e quanta memória usa.
- Proposta: um comando **só de leitura** que lista o que roda e o que ocupa disco. Melhor ainda, com o notebook ligado a
  mim, eu mesmo rodo e te conto.

## 6. Números e promessas de relatório

- Frases como "17 funções com JWT", "22/22 testes" ou "requisitos aprovados: 0" vieram dos relatórios do ChatGPT. Não
  tenho como conferir, e o código acima mostra que "17 funções" não quer dizer 17 funcionando.
- O que eu **contei hoje** na `main` do Vem Comer: **1.248 funções de teste do servidor** em 52 arquivos e **725 testes
  da parte visual** em 55 arquivos. Nos PRs abertos (#70, #71, #72) há mais. Os testes do servidor com banco de verdade
  rodam no GitHub a cada PR.

## O que isso muda no plano

1. **Fica:** o banco e as regras do servidor, os testes, a segurança, a atualização automática, a conformidade (tudo
   com prova acima).
2. **Sai ou se refaz:** a camada visual (o painel único herdado), a conversa por voz de verdade, e tudo que é só
   princípio sem código (o "sistema vivo").
3. **Decisões do GD:** quem é `luccanathaz`; retirar `mvp_payment.py` e `tenant_policy.py`; o que fazer com o Supabase
   antes de 02/11; deixar-me ver o `/opt/vem-tecnologia`.
