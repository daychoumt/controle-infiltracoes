PRAGMA foreign_keys = ON;
CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  stage TEXT NOT NULL CHECK(stage IN ('autorizacao','agendado','realizado','faturamento','concluido')),
  checks TEXT NOT NULL CHECK(json_valid(checks)),
  version INTEGER NOT NULL CHECK(version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE TABLE events (
  case_id TEXT NOT NULL REFERENCES cases(id),
  version INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor_uid TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('recepcao','faturamento','admin')),
  action TEXT NOT NULL,
  PRIMARY KEY(case_id,version)
);
CREATE INDEX idx_cases_created_id ON cases(created_at DESC,id DESC);
