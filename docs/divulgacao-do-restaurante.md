# Divulgação do restaurante: o que já existe, o que vem e o que só sai com o "pode" do GD

Escrito em 24/10/2026, a pedido do GD (23/10/2026, 21:22): "…o marketing, a venda, a busca de clientes, a retenção, a recorrência, a venda, a captação de novos clientes, o disparo de e-mails, a captura de e-mails, a captura de WhatsApp, captura de Telegram, imagens, marketing, o que você ainda tem para continuar fazendo, faça bem feito, sempre verificando o que está na espinha dorsal, que é um sistema vivo…".

A regra que organiza tudo isto vem de `LIVING_SYSTEM_SPINE.md` e de `docs/plano-de-crescimento-90-dias.md`: **tudo o que manda mensagem para uma pessoa, guarda dado pessoal, mexe com dinheiro ou tem texto jurídico não sai sem o "pode" do GD.** O que o dono do restaurante faz com as próprias mãos, com o que é dele (o link, o nome, os pratos, os preços, as fotos), pode ser construído já.

## 1. O que já existe: a tela "Meu link" (Divulgar), rodada 29

No painel novo (`?novo=1`, ainda desligado para o público), o dono abre **Meu link** e tem, de cima para baixo:

| O que é | O que o dono faz | De onde vem |
| --- | --- | --- |
| **Seu link** | Copiar o link; abrir para conferir | só o endereço do restaurante (nunca mesa, nunca painel) |
| **Mensagem pronta** | Mandar no WhatsApp; copiar; **Outra mensagem** (cinco jeitos de dizer a mesma coisa, sem repetir) | o nome do restaurante e o link |
| **Cartão de um prato** | Escolher o prato; escolher **Feed** (1080 × 1350, 4:5) ou **Status** (1080 × 1920, 9:16); mandar o cartão pelo compartilhar do celular ou baixar a imagem; copiar ou trocar o texto que vai junto | nome, preço e foto do cadastro |
| **Onde colocar** | Dicas de WhatsApp, Instagram e Mesas (atalho) | texto fixo |

**O que ela garante (cada item tem teste):**

- **Nada sai sozinho.** O WhatsApp abre com o texto pronto e **sem número**: quem recebe é o dono quem escolhe lá. O compartilhar do celular é ele quem usa. Nenhuma chamada grava coisa no servidor (conferido no navegador).
- **Nenhum dado de cliente entra.** Só o link, o nome do restaurante, o nome e o preço de um prato.
- **O cartão nunca inventa.** O nome e o preço são os do cadastro. Prato esgotado, sem nome ou sem preço válido não vira cartão (o cliente tocaria e não poderia pedir). As frases não prometem o que o sistema não sabe: um teste barra "hoje", "agora", "desconto", "grátis", "o melhor", "aproveite"…
- **Lê bem em qualquer foto.** A sombra verde-escura do fundo nasce acima do nome do prato; um teste calcula o contraste da letra **sobre uma foto branca** (o pior caso) e exige 4,5:1. Achei isso olhando o cartão em tamanho real: com prato claro o nome ficava fraco.
- **Foto que não carrega não quebra nada.** O cartão sai com fundo verde (um "prato" abstrato em dois tons).
- **Tudo é montado no celular do dono.** Nada da imagem sobe para o servidor.
- **As frases não envelhecem.** Mesmo motor das frases da voz (`novo/phrasing.ts`); texto em `novo/shareCopy.ts`; a data de revisão é a mesma (`PHRASES_REVIEWED`, lembrete agendado para 22/12/2026).
- **Acessível:** botões de 44 px, avisos lidos pelo leitor de tela ("Link copiado. Agora é só colar."), foto com texto alternativo ("Cartão de Pastel de carne, R$ 9,00, no tamanho Feed"), se o celular recusar copiar o texto aparece **marcado** para segurar e copiar.

**Duas escolhas minhas que o GD pode trocar:**

1. O cartão sai com **"Feito com o Vem Comer"** no pé, **ligado por padrão** (o dono desliga num toque). É divulgação orgânica do sistema a cada cartão postado. Se o GD preferir desligado por padrão, é uma linha.
2. O menu continua chamando a tela de **"Meu link"** (os donos já conhecem). Se o GD preferir **"Divulgar"**, é trocar o nome no menu e na voz.

**Limites honestos:** o cartão ainda **não tem QR Code** (não há biblioteca de QR no front-end; o servidor já sabe gerar, falta uma rota); a foto precisa ser do mesmo endereço do site (em produção é: `VITE_API_URL=/api` e o Caddy entrega `/media`); **não foi testado em celular de verdade** (compartilhar imagem, Instagram e status do WhatsApp estão na lista de `docs/teste-no-celular.md`).

## 2. O que vem a seguir, na ordem que eu proponho

Divido pelo que **eu posso construir sem enviar nada a ninguém** e o que precisa do "pode".

### 2.1 Posso construir já (o dono é quem aciona, ou é só leitura)

1. **Página pública do restaurante com prévia bonita e achável.** Hoje o link abre o aplicativo; quando o dono manda no WhatsApp a prévia é pobre e o Google não enxerga o cardápio. Página montada no servidor com título, foto e descrição do restaurante (Open Graph), dados estruturados do Google (JSON-LD de restaurante e cardápio), `sitemap.xml` e `robots.txt`. É backend: vai em ramo e PR próprios, em rascunho. **Segurança:** só dado que o restaurante já mostra ao cliente; nada de telefone do dono.
2. **QR Code do link do restaurante** (balcão, embalagem, adesivo de sacola): uma rota no servidor (`table_qr.qr_png_for_url` já existe) e um botão na tela Divulgar para baixar e imprimir.
3. **Mais formatos de cartão**: "Cardápio do dia" (três pratos juntos) e "Novidade" (um prato com faixa). Mesma regra: só dados do cadastro, só no toque do dono.
4. **Cartão com a logomarca do restaurante** (a logo já existe em `logomarca.md`).
5. **Medir sem espiar:** quantos toques no link vieram do WhatsApp, do Instagram ou do QR (marca no endereço, ex. `?de=qr`), mostrado no Hoje. Só contagem, sem dado pessoal.

### 2.2 Precisa da decisão do GD antes (dado pessoal ou dinheiro: Nível 3 e 2 do `LIVING_SYSTEM_SPINE.md`)

6. **"Meus clientes" e retenção:** perguntar no fim do pedido *"Posso te avisar de novidades deste restaurante? Sim / Não"* (padrão **Não**), guardar só quem disse sim (`consent_records`, com prova), separar por quem pede mais, quem sumiu há 30 dias, aniversariantes. **O dono manda pelo `wa.me`, uma pessoa por vez, ele aperta enviar.** Sem disparo em massa pelo sistema. É dado pessoal: o texto de privacidade e a base legal passam pelo advogado.
7. **Cupom e fidelidade** ("o décimo pastel é por conta da casa"): o desconto é recalculado no servidor; promoção com a base do dono é **Nível 2** (o dono do restaurante aprova); dinheiro é **Nível 3**.
8. **Captura de contatos para o próprio Vem** (lista de donos interessados, na página `?sistema=1`) com consentimento e e-mail de cancelar em um toque. Nada de mensagem fria por WhatsApp ou Telegram.
9. **E-mail:** rascunhos prontos para o dono e para o Vem, **sem envio**. Envio de verdade só com provedor escolhido, domínio autenticado (SPF, DKIM, DMARC), identificação da Vem Tecnologia, cancelar em um toque e o advogado vendo antes do volume.
10. **Canais de WhatsApp e Telegram do Vem** (comunidade do restaurante que entra por vontade própria): só links para a pessoa entrar. Nada de adicionar gente.

### 2.3 O que **não** farei, com ou sem pedido

Mensagem fria no WhatsApp ou no Telegram; lista comprada ou raspada de contatos pessoais; promessa que o sistema não sabe cumprir ("entrega em 20 minutos" sem medir); depoimento ou avaliação inventados; imagem de prato que não é o do restaurante.

## 3. As quatro decisões e o que o GD respondeu

O GD respondeu em 24/10/2026, 06:57: "…e para as demais decisões, tudo ok. Por favor, prosseguir." Tratei as quatro como **aprovadas como eu havia proposto**, sem que isso seja o "pode" para juntar, ir ao ar ou enviar mensagem:

1. **"Feito com o Vem Comer" no cartão: ligado por padrão** (como está). O dono pode desligar.
2. **Nome do menu: "Meu link"** (como está).
3. **Página pública do restaurante:** começo em **ramo separado, em rascunho** (próxima rodada desta frente).
4. **"Meus clientes":** escrevo o **texto de consentimento e o desenho da tela para o advogado ver**, sem ligar nada.

## 4. Duas frentes, duas responsabilidades

Na mesma mensagem o GD separou o trabalho em dois lados:

- **O dono do software (Vem Tecnologia)** entra em contato com clientes e vai atrás de clientes, "tudo isso o mais automatizado possível", para conquistar novos bares, restaurantes, sorveterias, pastelarias e outros. Isso é a **máquina de vendas do Vem** (`docs/maquina-de-vendas-do-vem.md`, PR #77): o sistema acha, lembra, mede e escreve o rascunho; uma pessoa do Vem envia, uma por vez, e toca em "Já mandei". Nada envia sozinho. A tela disso é a **Vendas** do painel novo, só para o dono do sistema (`docs/front-end-novo.md`, trigésima primeira rodada).
- **O dono do restaurante** tem o trabalho de marketing de **divulgar o link dele**: o da pastelaria, o da sorveteria, o da pizzaria. O Vem dá a ferramenta (esta tela, o cartão, o QR e, em seguida, a página pública); divulgar é trabalho dele.
