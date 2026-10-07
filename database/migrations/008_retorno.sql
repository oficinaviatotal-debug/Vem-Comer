-- "Como foi?": o retorno de quem usa o sistema, no fim de cada tarefa (pedido do GD, 07/10/2026).
--
-- Uma linha por resposta: em que tarefa (context), a nota em 3 rostinhos (1 ruim, 2 mais ou menos,
-- 3 bom) e, se a pessoa quis, o que melhorar (falado ou escrito). Serve para a melhoria diaria:
-- o dono do software le o resumo (deploy/vps/ver-retorno.sh) e decide o que muda.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    context varchar(40) NOT NULL,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 3),
    comment varchar(500),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created ON feedback (created_at);
