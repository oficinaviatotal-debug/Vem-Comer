# Página pública do restaurante (prévia no WhatsApp, achável no Google, QR do link)

Escrito em 24/10/2026, a pedido do GD ("Por favor, prosseguir", 24/10, 06:57, e "Execute da melhor forma, mais eficaz, inovadora, viva, contínua, criativa, segura, recorrente e de resultados", 24/10, 08:35). É a Rodada 32 da frente "o dono do restaurante divulga o link dele" (`docs/divulgacao-do-restaurante.md`).

**Estado: pronto no ramo `claude/pagina-publica-20261024`, em rascunho. DESLIGADO de fábrica.** Nada muda para ninguém até o GD juntar o pedido **e** rodar `abrir-pagina-publica.sh abrir` no servidor. Esta página não mexe no aplicativo que o cliente usa hoje.

## O problema

O link de um restaurante hoje é `https://SEU.SITE/?empresa=pastelaria-do-ze`. Para uma pessoa ele abre o aplicativo e funciona. Para quem só **lê o endereço** ele é uma página vazia:

- o WhatsApp, o Instagram e o Facebook mostram um quadrado cinza e o nome do site, sem foto e sem nome do restaurante;
- o Google não enxerga nenhum prato (o cardápio só aparece depois que o aplicativo carrega e pergunta ao servidor);
- num celular simples, com sinal ruim, o cliente espera o aplicativo inteiro baixar só para ver o cardápio.

## O que existe agora

Para cada restaurante, o **servidor monta uma página de verdade**, em `https://SEU.SITE/r/pastelaria-do-ze`:

| Parte | O que faz |
| --- | --- |
| **A página** | Nome, logomarca, se está aberto agora ("Aberto até 23h."), atalhos para as categorias, o cardápio inteiro com preço e foto, e o botão grande **Ver cardápio e pedir** que leva ao aplicativo. Sem nenhum script. Abre rápido em celular simples. |
| **A prévia** (`/r/…/previa.jpg`) | Um cartão 1200 × 630 que o WhatsApp, o Instagram e o Facebook mostram quando o link é colado: nome do restaurante grande, a foto do primeiro prato (ou a logomarca, ou um prato desenhado), "Cardápio e pedidos pelo celular". Letra da marca, com acento. Cerca de 45 KB. |
| **Dados do Google** | Marcação `Restaurant` e `Menu` (schema.org): nome, endereço da página, foto, categorias, pratos e preços em reais. |
| **QR Code** (`/r/…/qr.png?de=qr`) | O QR do link, para o balcão, a sacola, o adesivo. Leva à página. O `de=` marca de onde veio o toque. |
| **`robots.txt` e `sitemap.xml`** | Dizem ao Google o que pode ler. O sitemap lista só os restaurantes que o dono liberou (veja "Quem decide"). |

## O que a página mostra e o que ela nunca mostra

**Mostra** só o que o aplicativo do cliente já recebe de qualquer pessoa que tenha o link: nome, logomarca, se está recebendo pedidos, a frase do horário ("Aberto até 23h."), as categorias, os pratos (nome, texto, preço, foto, esgotado). A ordem é a mesma do aplicativo (`frontend/src/customer/menuGroups.ts`): categorias na ordem em que o restaurante criou, prato sem categoria por último em "Outros", categoria desligada some.

**Nunca mostra**: telefone do dono, e-mail, chave Pix, CNPJ, custos, pedidos, clientes, **os turnos do horário** (só a frase "Aberto até 23h."), e **nunca diz por que** um restaurante não recebe pedidos (plano bloqueado aparece como "Pedidos indisponíveis no momento."). Um teste monta um restaurante com telefone, e-mail, Pix e CNPJ e confere que nenhum deles chega à página, ao JSON do Google ou à imagem.

**Não conta ninguém, não grava nada, não tem cookie e não tem script.** A medição de "quantos toques vieram do WhatsApp" é a próxima rodada (precisa de uma tabela de contagem, sem dado pessoal).

## Quem decide: três chaves, cada uma com o "pode" de uma pessoa

1. **`PUBLIC_PAGE_OPEN` (servidor, do GD).** Desligada: `/r/…`, `/robots.txt` e `/sitemap.xml` respondem 404, como se não existissem. Ligada: a página e a prévia funcionam para quem tiver o link, e a página pede ao Google para **não** guardá-la (`noindex`).
2. **`PUBLIC_PAGE_INDEX` (servidor, do GD).** Só vale com a primeira. Convida o Google: o `robots.txt` passa a permitir `/r/` e aponta o `sitemap.xml`.
3. **"Aparecer no Google" (o dono do restaurante, uma coluna por restaurante, padrão: NÃO).** Mesmo com as duas chaves ligadas, só entra no Google (e no sitemap) o restaurante cujo dono disse sim. Os outros continuam com `noindex`. A escolha é do dono porque é o negócio dele que passa a aparecer numa busca pública.

Quem liga e desliga as duas primeiras, no servidor, sem mexer no arquivo à mão:

```bash
bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh status   # ver como está (pergunta ao servidor, não ao arquivo)
bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh abrir    # degrau 1: a página e a prévia (pede para digitar "abrir")
bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh google   # degrau 2: convida o Google (pede para digitar "google")
bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh fechar   # desliga tudo
```

Cada comando mexe só em duas linhas do `.env` e reinicia só o servidor (alguns segundos fora do ar). Os dois degraus pedem **palavras diferentes**: quem digita "abrir" não liga o Google sem querer. `abrir` e `google` só rodam num terminal (nunca em script). Testado com um Docker de mentira (`deploy/vps/test_abrir_pagina_publica.py`, 14 casos).

## Para o dono do restaurante (próxima rodada, na tela "Meu link")

O servidor já tem o que a tela precisa:

- `GET /api/admin/public-page` → `{ open, indexed, listed, can_change, slug, page_url, qr_path }` (dono e gerente leem, porque os dois mandam o link; `can_change` diz se quem lê pode mudar);
- `PUT /api/admin/public-page` com `{"listed": true|false}` → "Aparecer no Google". **Só o dono** (`OWNER`). Só aceita verdadeiro ou falso de verdade (`"sim"` ou `1` são recusados).

A tela vai: mostrar o link novo no lugar do link velho **somente quando `open` for verdadeiro** (antes disso, o link velho continua), baixar o QR, e ter o interruptor "Aparecer no Google" com a frase honesta do que ele faz. O link velho (`/?empresa=…`) continua funcionando para sempre: a página nova só leva até ele.

## Segurança (cada item tem teste)

- **Texto do dono nunca chega cru.** Nome do restaurante, categoria, prato, texto e subseção passam por `html.escape`. O JSON do Google troca `<`, `>`, `&` e as quebras de linha especiais: um prato chamado `</script><script>alert(1)</script>` continua sendo só um nome.
- **Política de segurança do navegador (CSP) fechada:** `default-src 'none'`, imagens e letras só do próprio site, sem script, sem formulário, sem iframe. O estilo é permitido por **hash** do próprio bloco (não por `unsafe-inline`); um teste confere o hash.
- **Endereços montados só de peças validadas:** o nome do restaurante só passa com letras minúsculas, números e hífen (inclusive sem quebra de linha escondida no fim, defeito que um teste achou); a marca `de=` só aceita uma lista curta (`whatsapp`, `instagram`, `facebook`, `tiktok`, `telegram`, `google`, `qr`); o endereço do site vem de `PUBLIC_BASE_URL` (o instalador põe) e é validado.
- **Limite por endereço de rede:** 90 páginas e 30 imagens por minuto (configurável), para frear robô em laço; o sitemap fica guardado 10 minutos; a imagem da prévia fica guardada na memória (64 últimas).
- **Erro nunca vaza detalhe:** banco fora do ar vira "Tente de novo em instantes" (503), sem texto técnico. Nome que não existe e nome malformado têm a **mesma** resposta (não dá para listar quem existe).
- **Só leitura, nenhum dado de pessoa.** A única gravação é o sim/não do dono sobre o próprio restaurante, e o `UPDATE` sempre usa o restaurante do login (um dono não muda a escolha de outro; testado).
- **A letra da marca vai junto com a licença:** `backend/fonts/` tem Bricolage Grotesque e Instrument Sans (os mesmos do aplicativo) e os dois arquivos OFL.

## O que foi conferido

- `backend/test_public_page.py` (65): chaves desligadas, entradas, preço, texto, horário, ordem das categorias igual à do aplicativo, escape, JSON do Google, contraste das cores (todas passam de 4,5:1), CSP, sitemap, robots, limite, imagem da prévia (acento desenhado, tamanho, nome enorme, foto estragada).
- `backend/test_public_page_routes.py` (33): 404 em tudo com a chave desligada **sem tocar no banco**, cada rota, limite 429, 503 sem detalhe, a escolha do dono (login, cargo: o gerente lê mas não muda; só `true` ou `false`).
- `backend/test_public_page_db.py` (11, PostgreSQL de verdade): um restaurante nunca mostra o prato de outro, categoria desligada some, esgotado aparece, o texto escapado depois de ir e voltar do banco, só quem disse sim entra no sitemap.
- `deploy/vps/test_abrir_pagina_publica.py` (14).
- Migração `022_pagina_publica.sql` (uma coluna, padrão falso) aplicada duas vezes sem erro.
- Imagem da prévia vista com foto e logomarca, sem foto, com nome longo e com acento.

## O que ainda falta (nesta ordem)

1. **Tela "Aparecer no Google" e QR na tela Meu link** (ramo do front, depende desta junção).
2. **Contagem de origem** (`?de=whatsapp`, `?de=qr`): quantos toques vieram de cada lugar, no Hoje do dono. Uma tabela de contagem por dia, sem dado pessoal, sem cookie.
3. **Conferir no WhatsApp de verdade**: colar o link e ver a prévia (depende de o servidor estar no ar com a chave ligada; entra em `docs/teste-no-celular.md`).
4. **Testar no Google**: o teste de resultados enriquecidos e o Search Console (depende do domínio e do degrau 2).
5. **O Caddy não foi rodado aqui** (sem Docker neste ambiente). A mudança no `Caddyfile` são três blocos `handle` iguais ao que já existe para `/api/*`; vale olhar `docker logs vemcomer-web` depois da primeira atualização.

## O que **não** foi feito, de propósito

- Não liguei nada, não juntei nada, não gerei link público.
- Não coloquei turnos do horário, telefone, endereço da rua nem avaliações na página: o sistema não tem endereço da rua cadastrado e não vou inventar. Quando existir, entra com o "pode" do dono.
- Não usei o nome do restaurante em nenhum lugar do endereço além do que o restaurante já tem (`/r/<nome-do-endereço>`).
