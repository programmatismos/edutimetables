/**
 * initDb() — creates all tables (IF NOT EXISTS) for the SQLite / Electron path.
 * Called once at server startup before seedIfEmpty().
 * For web/Turso this is a no-op (Turso schema is managed via drizzle-kit push).
 */

export function initDb(sqlite: any) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS school (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL DEFAULT 'Σχολική Μονάδα',
      type        TEXT    NOT NULL DEFAULT 'ΓΕΛ',
      exam_start  TEXT,
      exam_end    TEXT,
      updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT    NOT NULL,
      start_time        TEXT    NOT NULL,
      end_time          TEXT    NOT NULL,
      duration_minutes  INTEGER NOT NULL DEFAULT 120,
      "order"           INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS school_unavailable (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      date    TEXT NOT NULL,
      reason  TEXT
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name       TEXT    NOT NULL,
      last_name        TEXT    NOT NULL,
      specialty        TEXT    NOT NULL,
      specialty_label  TEXT,
      role             TEXT    NOT NULL DEFAULT 'both',
      education_type   TEXT    NOT NULL DEFAULT 'general',
      created_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS teacher_unavailable (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      date        TEXT    NOT NULL,
      shift_id    INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
      reason      TEXT
    );

    CREATE TABLE IF NOT EXISTS classes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      grade         TEXT    NOT NULL,
      department    TEXT,
      label         TEXT    NOT NULL,
      school_type   TEXT    NOT NULL DEFAULT 'ΓΕΛ',
      grade_order   INTEGER NOT NULL DEFAULT 2,
      student_count INTEGER NOT NULL DEFAULT 0,
      force_split   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT    NOT NULL,
      class_id          INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      presenter_id      INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      subject_type      TEXT    NOT NULL DEFAULT 'general',
      duration_minutes  INTEGER NOT NULL DEFAULT 120,
      specialty         TEXT,
      priority          INTEGER NOT NULL DEFAULT 5,
      can_split         INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exam_schedule (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id          INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      date                TEXT    NOT NULL,
      shift_id            INTEGER NOT NULL REFERENCES shifts(id),
      presenter_id        INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      supervisor_ids      TEXT    NOT NULL DEFAULT '[]',
      is_manually_placed  INTEGER DEFAULT 0,
      notes               TEXT,
      created_at          TEXT,
      updated_at          TEXT
    );

    CREATE TABLE IF NOT EXISTS schedule_runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT,
      score       REAL,
      violations  TEXT DEFAULT '[]',
      status      TEXT NOT NULL DEFAULT 'pending'
    );
  `);
}
