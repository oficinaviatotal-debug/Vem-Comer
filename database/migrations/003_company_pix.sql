-- Pix do restaurante (Pix estatico).
-- O dinheiro vai direto do cliente para a conta do restaurante; aqui ficam
-- apenas os dados para montar o codigo "Pix Copia e Cola".
--
-- Seguro para rodar mais de uma vez. Rode ANTES de publicar a versao do
-- servidor que usa estas colunas. Sem estas colunas, as telas de Pix
-- simplesmente nao aparecem (o restante do sistema continua funcionando).
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS pix_key_type varchar(10)
        CHECK (pix_key_type IN ('cpf', 'cnpj', 'phone', 'email', 'random')),
    ADD COLUMN IF NOT EXISTS pix_key varchar(77),
    ADD COLUMN IF NOT EXISTS pix_receiver_name varchar(25),
    ADD COLUMN IF NOT EXISTS pix_city varchar(15);
