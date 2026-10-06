-- Cadastro do restaurante pela internet.
--
-- 1) O que o restaurante aceitou e como contatar o dono:
--    created_at         quando o restaurante foi criado (o banco do servidor ainda nao tinha esta coluna;
--                       os restaurantes que ja existem ficam com a data desta migracao). O limite diario
--                       de cadastros conta por ela.
--    owner_phone        WhatsApp do dono, so digitos com DDI (ex.: 5584999999999). Opcional.
--    terms_version      versao dos termos de uso aceita no cadastro
--    terms_accepted_at  quando aceitou
--    signup_source      'web' quando o dono se cadastrou sozinho; vazio quando o administrador criou
--
-- 2) E-mail unico em todo o sistema. O login procura so pelo e-mail; com o mesmo e-mail em dois
--    restaurantes, o login poderia cair na conta errada (ou ser bloqueado de proposito por quem se
--    cadastra com o e-mail de outra pessoa). O indice so e criado se hoje nao houver e-mail repetido:
--    se houver, a migracao avisa e segue, e o servidor continua conferindo antes de gravar.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS owner_phone varchar(20),
    ADD COLUMN IF NOT EXISTS terms_version varchar(20),
    ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
    ADD COLUMN IF NOT EXISTS signup_source varchar(20);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
        RAISE NOTICE 'Ha e-mails repetidos em users: indice unico de e-mail NAO criado. Corrija os repetidos e rode de novo.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));
    END IF;
END
$$;
