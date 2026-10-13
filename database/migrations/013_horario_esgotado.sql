-- Horario de funcionamento, pausa de pedidos e prato esgotado (pedido do GD: "pequenos, e o cliente sente na hora").
--
-- Horario: a tabela business_hours ja existia, mas nada a usava. Ganha um SEGUNDO turno por dia (almoco e jantar):
-- opens_at/closes_at e opens_at_2/closes_at_2. Fechar antes de abrir quer dizer que o turno passa da meia-noite
-- (18:00 as 02:00). Dia com accepts_orders = false e dia fechado. Restaurante sem NENHUMA linha esta sempre aberto,
-- entao nada muda para quem ja existe.
--
-- Pausa: um botao do dono ("estamos lotados, pausa") que vale para todos os pedidos, mesa inclusive.
--
-- Esgotado: um toque no painel tira o prato dos pedidos (ele continua aparecendo no cardapio, marcado como esgotado).
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS opens_at_2 time without time zone;
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS closes_at_2 time without time zone;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS orders_paused boolean NOT NULL DEFAULT false;

ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false;
