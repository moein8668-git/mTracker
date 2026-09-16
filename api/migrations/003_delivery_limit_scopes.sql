CREATE TABLE delivery_limit_scopes (kind text NOT NULL, scope_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, scope_id));
