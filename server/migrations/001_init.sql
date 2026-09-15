CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email citext NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON otp_codes (email, created_at DESC);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE sync_seq;

CREATE TABLE tasks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL, name text NOT NULL,
  target_daily_hours numeric(6,2) NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#4f46e5',
  days_per_week int NOT NULL DEFAULT 7,
  created_at timestamptz, archived_at timestamptz,
  updated_at timestamptz NOT NULL, deleted_at timestamptz,
  seq bigint NOT NULL DEFAULT nextval('sync_seq'),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE entries (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL, task_id text NOT NULL,
  date date NOT NULL, hours numeric(6,2) NOT NULL,
  note text NOT NULL DEFAULT '', pomo boolean NOT NULL DEFAULT false,
  created_at timestamptz, updated_at timestamptz NOT NULL, deleted_at timestamptz,
  seq bigint NOT NULL DEFAULT nextval('sync_seq'),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX ON entries (user_id, seq);

CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
