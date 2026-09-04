CREATE TABLE IF NOT EXISTS patients (
  prontuario TEXT PRIMARY KEY,
  paciente TEXT NOT NULL,
  convenio TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(paciente);

UPDATE cases
SET payload = json_set(
  payload,
  '$.dataPedido', COALESCE(json_extract(payload, '$.dataPedido'), substr(created_at, 1, 10)),
  '$.dataAplicacao', COALESCE(json_extract(payload, '$.dataAplicacao'), json_extract(payload, '$.data'), ''),
  '$.dataFaturamento', COALESCE(
    json_extract(payload, '$.dataFaturamento'),
    CASE WHEN stage_v2 = 'faturamento' OR stage = 'concluido' THEN substr(updated_at, 1, 10) ELSE '' END
  )
);

INSERT OR IGNORE INTO patients (prontuario, paciente, convenio, created_at, updated_at, created_by)
SELECT
  json_extract(payload, '$.prontuario'),
  json_extract(payload, '$.paciente'),
  json_extract(payload, '$.convenio'),
  created_at,
  updated_at,
  created_by
FROM cases
WHERE json_extract(payload, '$.prontuario') IS NOT NULL
ORDER BY updated_at DESC;
