CREATE TABLE IF NOT EXISTS users (
  user_id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS scans (
  scan_id text PRIMARY KEY,
  user_id text REFERENCES users(user_id) ON DELETE SET NULL,
  media_type text NOT NULL,
  filename text,
  file_size integer,
  verdict text NOT NULL,
  confidence double precision NOT NULL,
  risk_level text,
  summary text,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifacts_detected jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text,
  audio_features jsonb,
  frame_analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scans_user_created_idx ON scans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scans_media_verdict_idx ON scans (media_type, verdict);
