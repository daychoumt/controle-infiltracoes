-- Evita duplicidade mesmo quando duas pessoas cadastram ou corrigem o mesmo
-- processo ao mesmo tempo. O índice simples acelera o perfil do paciente.
CREATE INDEX IF NOT EXISTS idx_cases_prontuario
ON cases(json_extract(payload, '$.prontuario'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_active_process
ON cases(
  json_extract(payload, '$.prontuario'),
  json_extract(payload, '$.articulacao'),
  json_extract(payload, '$.lado'),
  json_extract(payload, '$.numeroAplicacao')
)
WHERE stage_v3 NOT IN ('faturamento', 'cancelado');

PRAGMA optimize;
