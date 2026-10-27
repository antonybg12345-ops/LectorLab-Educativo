-- Version 1: one installation, individual accounts and teacher-owned resources.
-- PostgreSQL syntax is shared by embedded PGlite and an external PostgreSQL server.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  owner_id TEXT REFERENCES users(id),
  password_hash TEXT NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((role = 'teacher' AND owner_id IS NULL) OR (role = 'student' AND owner_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS enrollments (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(group_id, student_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  reading_text TEXT NOT NULL,
  reading_hash TEXT NOT NULL,
  source JSONB NOT NULL DEFAULT '{}'::jsonb,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  parent_id TEXT REFERENCES activities(id),
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  activity_id TEXT NOT NULL REFERENCES activities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, activity_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'reviewed')),
  draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  objective_score INTEGER,
  max_objective INTEGER,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);
CREATE TABLE IF NOT EXISTS tutor_turns (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal > 0),
  state TEXT NOT NULL CHECK (state IN ('pending', 'completed', 'failed', 'unknown')),
  student_text TEXT NOT NULL,
  assistant_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, request_id),
  UNIQUE(attempt_id, ordinal)
);
CREATE TABLE IF NOT EXISTS assessments (
  attempt_id TEXT PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  result_version INTEGER NOT NULL DEFAULT 0 CHECK (result_version >= 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'synced', 'error')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, result_version)
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  text_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS groups_owner_idx ON groups(owner_id);
CREATE INDEX IF NOT EXISTS users_owner_idx ON users(owner_id);
CREATE INDEX IF NOT EXISTS enrollments_student_idx ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS activities_owner_idx ON activities(owner_id);
CREATE INDEX IF NOT EXISTS assignments_owner_idx ON assignments(owner_id);
CREATE INDEX IF NOT EXISTS assignments_group_idx ON assignments(group_id);
CREATE INDEX IF NOT EXISTS attempts_student_idx ON attempts(student_id);
CREATE INDEX IF NOT EXISTS attempts_assignment_idx ON attempts(assignment_id);
CREATE INDEX IF NOT EXISTS tutor_turns_attempt_idx ON tutor_turns(attempt_id, state);
CREATE INDEX IF NOT EXISTS outbox_owner_state_idx ON sync_outbox(owner_id, state);
CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id);

INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT (version) DO NOTHING;
