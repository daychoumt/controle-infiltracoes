-- Independent planning records; existing guides and billing remain intact.
CREATE TABLE agenda_courses (
  id TEXT PRIMARY KEY,
  prontuario TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE UNIQUE INDEX agenda_active_patient ON agenda_courses(prontuario) WHERE archived = 0;
CREATE TABLE agenda_events (
  course_id TEXT NOT NULL REFERENCES agenda_courses(id),
  version INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(course_id,version)
);
CREATE TABLE agenda_closings (
  day TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  course_versions TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  closed_at TEXT NOT NULL,
  closed_by TEXT NOT NULL
);
