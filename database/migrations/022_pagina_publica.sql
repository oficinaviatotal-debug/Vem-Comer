-- Página pública do restaurante (/r/<restaurante>): quem decide se o Google pode guardar a página é o DONO do restaurante.
--
-- O padrão é NÃO: nenhum restaurante aparece no Google (nem no sitemap.xml) até o dono tocar em "Aparecer no Google"
-- na tela "Meu link". A página em si (a prévia bonita no WhatsApp) não depende disto. Enquanto o administrador do
-- sistema não ligar PUBLIC_PAGE_INDEX no servidor (deploy/vps/abrir-pagina-publica.sh indexar), esta escolha não tem efeito.
--
-- Não guarda dado de pessoa: só um sim ou não sobre o próprio restaurante.
-- Seguro para rodar mais de uma vez. O instalador roda esta migração ANTES de subir a nova versão.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS public_page_listed boolean NOT NULL DEFAULT false;
