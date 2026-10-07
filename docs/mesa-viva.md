# Mesa viva: chamar garçom (primeira parte)

Pedido do GD (07/10/2026, requisito 57 de `requisitos-do-dono-vem-comer.md`).

## O que o cliente vê

Quem lê o QR da mesa cai na **tela da mesa** (antes caía direto no cardápio):

- **Ver cardápio e pedir**: o botão principal, leva ao cardápio de sempre.
- **Chamar garçom** e **Pedir a conta**: botões grandes.
- **Água** e **Limpeza**: botões pequenos.
- **Trabalhe aqui**: só aparece se o endereço do Vem Trabalhar estiver configurado (veja abaixo).

Depois do toque o botão vira "Chamado" por 1 minuto (para ninguém tocar à toa) e depois "Chamar de novo".
A tela pergunta a cada 8 segundos se já atenderam (só enquanto está aberta e à vista) e mostra "Atendido".
O número da mesa no topo do cardápio é um botão que volta a essa tela. Mesa que não existe vai direto ao
cardápio, como antes. Quem já fez pedido continua caindo no acompanhamento do pedido.

## O que a equipe vê

No topo do painel, em qualquer aba, aparece "N mesas chamando": "Mesa 4 chama o garçom, há 2 min" e o botão
**Atender**. Chamada nova faz o aparelho vibrar e apitar uma vez. A linha fica amarela depois de 3 minutos
e vermelha depois de 7 minutos, ou quando o cliente toca de novo (2 vezes ou mais); quando vira vermelha o
aparelho avisa mais uma vez. Qualquer pessoa da equipe do restaurante vê e atende.

## Como funciona por dentro

- Tabela `table_calls` (migração `009_chamadas_mesa.sql`, segura para rodar mais de uma vez).
- Rotas públicas (sem login), só para mesas que existem naquele restaurante:
  - `POST /api/companies/<id>/tables/<mesa>/calls` com `{"kind": "garcom|conta|agua|limpeza"}`
  - `GET  /api/companies/<id>/tables/<mesa>/calls/<chamada>`: só o tipo e se já foi atendida.
- Rotas do painel (com login, do mesmo restaurante):
  - `GET  /api/companies/<id>/admin/table-calls`: chamadas abertas, a mais antiga primeiro.
  - `POST /api/companies/<id>/admin/table-calls/<chamada>/answer`: atender (guarda a hora e quem atendeu).
- Tocar de novo numa chamada igual ainda aberta **não cria outra linha**: só sobe o contador `repeats`.
- Chamada aberta há mais de 2 horas é esquecida (some do painel e o cliente pode chamar de novo).
- Proteções da porta pública: limite por endereço de rede (60 por hora) e por mesa (8 a cada 10 minutos).
  Os limites ficam em memória: ao reiniciar o servidor a contagem zera.
- O tempo entre `created_at` e `answered_at` é o número que vira a meta do garçom (requisito 11).
  Ainda não há tela para ele.

## Configuração

- `VITE_VEM_TRABALHAR_URL` (opcional, endereço `https://`): liga o botão "Trabalhe aqui". Vazio = sem o botão.
  Entra no build do site (`deploy/vps/docker-compose.yml`, argumento de build). Só funciona quando o domínio do
  Vem Trabalhar existir.

## Próximos passos

Modo garçom (requisito 65: mesas por área e por garçom, alerta de ticket, sugestão de venda), "Como foi?" ao
sair da mesa, e a meta de tempo de resposta do garçom.
