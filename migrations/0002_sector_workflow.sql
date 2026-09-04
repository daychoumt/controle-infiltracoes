-- A nova coluna preserva integralmente a tabela e os estados legados. Ela pode
-- ser aplicada em uma base já preenchida sem recriar ou apagar registros.
ALTER TABLE cases ADD COLUMN stage_v2 TEXT NOT NULL DEFAULT 'recebido'
  CHECK(stage_v2 IN ('recebido','solicitado','agendado','realizado','conferencia','faturamento'));

UPDATE cases SET stage_v2 =
  CASE stage
    WHEN 'autorizacao' THEN 'solicitado'
    WHEN 'concluido' THEN 'faturamento'
    ELSE stage
  END;
