ALTER TABLE patients ADD COLUMN updated_by TEXT;

CREATE TABLE IF NOT EXISTS patient_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prontuario TEXT NOT NULL,
  at TEXT NOT NULL,
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  FOREIGN KEY (prontuario) REFERENCES patients(prontuario)
);

CREATE INDEX IF NOT EXISTS idx_patient_events_chart ON patient_events(prontuario, at DESC);
