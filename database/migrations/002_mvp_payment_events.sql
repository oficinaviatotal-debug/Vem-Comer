-- MVP payment webhook idempotency boundary.
-- Apply only through the normal migration process; not executed by this PR.
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id bigserial PRIMARY KEY,
    provider varchar(64) NOT NULL,
    event_id varchar(255) NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, event_id)
);
