# Pedido de ajuda e acompanhamento do cadastro

Pedido do GD (07/10): o dono que trava no cadastro do cardápio precisa de alguém, e o cardápio dele tem de ficar
todo cadastrado em até 3 dias. Duas partes: o botão **Preciso de ajuda** (o dono chama) e a aba **Chamados** (o GD
enxerga quem travou, mesmo sem chamar, e quanto tempo os outros levaram).

## O que o dono vê

1. Botão **Ajuda** no alto do painel (donos e gerentes) e botão **Preciso de ajuda** na barra do Assistente do
   cardápio. Também dá para **falar** ("preciso de ajuda", "me ajuda", "travei", "quero falar com uma pessoa"):
   o assistente para de ouvir e abre o pedido. "Não preciso de ajuda" não abre nada.
2. O pedido abre no alto da tela: o **assunto** (Cadastrar o cardápio, Foto de prato, Logomarca, Pedidos, Plano e
   pagamento, Deu erro, Outra coisa; já vem marcado o que combina com a tela em que ele está), um campo de texto
   (dá para ditar pelo microfone do teclado do celular, até 500 letras) e o WhatsApp dele, se for diferente do
   cadastro. Só "Outra coisa" exige umas palavras.
3. **Pedir ajuda** → "Recebi o seu pedido. Uma pessoa do Vem Comer vai falar com você." Se houver WhatsApp de
   suporte configurado, aparece também **Falar agora pelo WhatsApp** com a mensagem já escrita (nome, restaurante,
   assunto e o que ele escreveu).
4. Pedir de novo com um pedido ainda aberto **atualiza o mesmo pedido** (e sobe o contador "pediu de novo"); não cria
   outro. Sem texto novo, fica o texto de antes. No máximo 6 pedidos por hora por restaurante.

## O que o GD vê (aba Chamados, só nos logins de `PLATFORM_ADMIN_EMAILS`)

- **Pedidos abertos**: restaurante, dono, assunto, há quanto tempo espera, quantas vezes pediu de novo, em que tela
  estava, o texto, **Responder no WhatsApp** (mensagem pronta) e **Resolvido**. Quem pediu de novo aparece em
  vermelho e primeiro.
- **Cadastros pela internet** (só restaurantes que se cadastraram sozinhos): quantos pratos já têm, há quanto tempo
  se cadastraram e o prazo de 3 dias: *Chegou agora*, *Parado* (1 dia), *Falta pouco* (2 dias), *Passou do prazo*
  (3 dias ou mais) ou *Cardápio pronto*. Quem ainda não terminou tem **Chamar no WhatsApp** com a mensagem pronta
  ("é só mandar uma foto ou uma planilha do cardápio que eu cadastro").
- **O cronômetro**: "2 de 4 cadastraram o cardápio dentro de 3 dias. Tempo típico: 2 h." O cardápio conta como
  cadastrado a partir de **5 pratos ativos**; o tempo é do cadastro até a hora em que o 5º prato entrou. É o teste
  cronometrado do "em até 3 dias", só que com dono de verdade e sem ninguém anotar.
- Quem não terminou e já passou de 30 dias sai da lista.

## Por baixo

- Migração `database/migrations/014_pedidos_de_ajuda.sql` (tabela `help_requests`, segura para rodar mais de uma
  vez; o instalador roda sozinho antes de subir a versão nova).
- `backend/help_requests.py` (regras e SQL), rotas em `backend/app.py`: `POST /api/admin/help` (OWNER/MANAGER),
  `GET /api/platform/help` e `POST /api/platform/help/<id>/resolve` (administrador da plataforma).
- O texto do dono só aparece no painel do administrador; a tela escreve com React (nada de HTML cru) e só abre links
  `https://wa.me/…`, venha o que vier do servidor.
- WhatsApp de suporte: `SUPPORT_WHATSAPP` no `.env`; sem ele usa `BILLING_CONTACT_PHONE`, o mesmo da cobrança. Sem
  nenhum dos dois o pedido chega do mesmo jeito à aba Chamados, só não aparece o botão do WhatsApp para o dono.

## O que ainda não faz

- Não avisa o celular do GD quando chega um pedido: ele vê a aba (e o número no nome da aba). O aviso entra quando o
  notebook estiver ligado e a rotina diária/de 30 minutos puder consultar a caixa.
- Não responde pelo sistema; a conversa é pelo WhatsApp.
