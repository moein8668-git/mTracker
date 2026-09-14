CREATE TABLE otp_delivery_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  recipient_hash text NOT NULL, source_id text NOT NULL, account_id text NOT NULL,
  relay_status text NOT NULL DEFAULT 'pending' CHECK (relay_status IN ('pending','accepted','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON otp_delivery_attempts (recipient_hash, created_at DESC);
CREATE INDEX ON otp_delivery_attempts (source_id, created_at DESC);
CREATE INDEX ON otp_delivery_attempts (account_id, created_at DESC);
