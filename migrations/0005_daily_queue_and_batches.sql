ALTER TABLE cases ADD COLUMN stage_v3 TEXT NOT NULL DEFAULT 'recebido'
  CHECK(stage_v3 IN ('recebido','solicitado','autorizado','agendado','realizado','conferencia','pronto_faturamento','faturamento','cancelado'));

ALTER TABLE cases ADD COLUMN stage_changed_at TEXT;

UPDATE cases
SET stage_v3 = CASE stage_v2
  WHEN 'agendado' THEN 'autorizado'
  WHEN 'conferencia' THEN 'pronto_faturamento'
  ELSE stage_v2
END,
stage_changed_at = updated_at;

CREATE TABLE IF NOT EXISTS delivery_batches (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  competencia TEXT NOT NULL CHECK(competencia GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  convenio TEXT NOT NULL,
  recebido_por TEXT NOT NULL,
  observacao TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_batch_items (
  batch_id TEXT NOT NULL REFERENCES delivery_batches(id),
  case_id TEXT NOT NULL UNIQUE REFERENCES cases(id),
  PRIMARY KEY(batch_id,case_id)
);

CREATE INDEX IF NOT EXISTS idx_batches_created ON delivery_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON delivery_batch_items(batch_id);
