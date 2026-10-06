-- Fotos do cardapio: uma foto por prato e o logotipo do restaurante.
-- Guardamos so a "chave" sorteada de cada foto; os arquivos ficam no volume de fotos do servidor
-- (veja backend/media_store.py). Sem foto, a coluna fica vazia e o cardapio segue normal.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS image_key varchar(32);

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS logo_key varchar(32);
