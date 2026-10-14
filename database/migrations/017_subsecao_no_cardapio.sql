-- Subseção do cardápio (requisito 69, fala do GD de 14/10/2026): dentro de uma categoria, um título menor que agrupa
-- pratos. Exemplos: Pizzas > Tradicionais / Especiais / Doces; Bebidas > Refrigerantes / Sucos / Cervejas.
--
-- É só um texto no prato (products.subcategory), não uma tabela nova: o cardápio do cliente agrupa os pratos da
-- categoria pelo mesmo texto, na ordem em que aparecem. Vazio (NULL) é o normal: a maioria dos cardápios não tem subseção.
-- Quem lê o cardápio de foto, PDF ou planilha preenche; o dono confere na tela antes de cadastrar.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migração ANTES de subir a nova versão.
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory varchar(100);
