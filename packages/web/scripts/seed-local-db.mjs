/**
 * CI seed script — runs after drizzle-kit push to populate local.db
 * with default data so the bundled DB ships pre-seeded.
 * Usage: node scripts/seed-local-db.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../local.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = OFF");

// Wipe existing data
sqlite.exec(`
  DELETE FROM exam_schedule;
  DELETE FROM schedule_runs;
  DELETE FROM subjects;
  DELETE FROM teacher_unavailable;
  DELETE FROM teachers;
  DELETE FROM classes;
  DELETE FROM school_unavailable;
  DELETE FROM shifts;
  DELETE FROM school;
`);

// School
sqlite.prepare(`
  INSERT INTO school (name, type, exam_start, exam_end, updated_at)
  VALUES (?, ?, NULL, NULL, ?)
`).run("1ο ΓΕΛ Πόλης", "ΓΕΛ", new Date().toISOString());

// Shifts
const insertShift = sqlite.prepare(`
  INSERT INTO shifts (name, start_time, end_time, duration_minutes, "order")
  VALUES (?, ?, ?, ?, ?)
`);
insertShift.run("Α Βάρδια (Πρωινή)",     "09:00", "11:00", 120, 1);
insertShift.run("Β Βάρδια (Μεσημβρινή)", "11:00", "13:00", 120, 2);

// Classes
const insertClass = sqlite.prepare(`
  INSERT INTO classes (grade, department, label, school_type, grade_order, student_count, force_split)
  VALUES (?, NULL, ?, 'ΓΕΛ', ?, 25, 0)
`);
const cA = insertClass.run("Α", "Α ΓΕΛ", 1).lastInsertRowid;
const cB = insertClass.run("Β", "Β ΓΕΛ", 2).lastInsertRowid;
const cG = insertClass.run("Γ", "Γ ΓΕΛ", 3).lastInsertRowid;

// Subjects
const ins = sqlite.prepare(`
  INSERT INTO subjects (name, class_id, subject_type, duration_minutes, priority, specialty)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Α ΓΕΛ
ins.run("Νέα Ελληνική Γλώσσα & Λογοτεχνία", cA, "general", 120, 1, null);
ins.run("Ιστορία",                            cA, "general", 120, 2, null);
ins.run("Μαθηματικά Ι",                       cA, "general", 120, 2, null);
ins.run("Βιολογία",                           cA, "general", 120, 3, null);
ins.run("Φυσική",                             cA, "general", 120, 3, null);
ins.run("Χημεία",                             cA, "general", 120, 3, null);
ins.run("Αρχαία Ελληνική Γλώσσα",             cA, "general", 120, 4, null);
ins.run("Αγγλικά",                            cA, "general", 120, 5, null);

// Β ΓΕΛ
ins.run("Νέα Ελληνική Γλώσσα & Λογοτεχνία", cB, "general", 120, 1, null);
ins.run("Ιστορία",                            cB, "general", 120, 2, null);
ins.run("Μαθηματικά ΙΙ",                      cB, "general", 120, 2, null);
ins.run("Βιολογία",                           cB, "general", 120, 3, null);
ins.run("Φυσική",                             cB, "general", 120, 3, null);
ins.run("Χημεία",                             cB, "general", 120, 3, null);
ins.run("Αρχαία Ελληνική Γλώσσα",             cB, "general", 120, 4, null);
ins.run("Αγγλικά",                            cB, "general", 120, 5, null);

// Γ ΓΕΛ
ins.run("Νέα Ελληνική Γλώσσα & Λογοτεχνία",    cG, "general",   120, 1, null);
ins.run("Ιστορία",                              cG, "general",   120, 1, null);
ins.run("Μαθηματικά",                           cG, "general",   120, 2, null);
ins.run("Βιολογία",                             cG, "general",   120, 2, null);
ins.run("Φυσική",                               cG, "general",   120, 2, null);
ins.run("Χημεία",                               cG, "general",   120, 2, null);
ins.run("Αρχαία Ελληνική Γλώσσα & Γραμματεία", cG, "general",   120, 3, null);
ins.run("Αγγλικά",                              cG, "general",   120, 4, null);
ins.run("Αρχές Οικονομικής Θεωρίας",            cG, "specialty", 180, 1, "ΠΕ80");
ins.run("Λογιστική - Χρηματοοικονομική",        cG, "specialty", 180, 1, "ΠΕ80");

// Teachers
const insT = sqlite.prepare(`
  INSERT INTO teachers (first_name, last_name, specialty, specialty_label, role, education_type, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const now = new Date().toISOString();
insT.run("Παναγιώτης", "Παπαδόπουλος", "ΠΕ02", "Φιλόλογος",           "both",       "general",   now);
insT.run("Μαρία",      "Νικολάου",      "ΠΕ03", "Μαθηματικός",         "both",       "general",   now);
insT.run("Δημήτρης",   "Αντωνίου",      "ΠΕ04", "Φυσικός",             "both",       "general",   now);
insT.run("Ελένη",      "Κωνσταντίνου",  "ΠΕ04", "Χημικός",             "both",       "general",   now);
insT.run("Γιώργος",    "Σταματίου",     "ΠΕ06", "Αγγλικής Φιλολογίας", "both",       "general",   now);
insT.run("Αικατερίνη", "Δημητρίου",     "ΠΕ01", "Θεολόγος",            "supervisor", "general",   now);
insT.run("Νικόλαος",   "Παπαγεωργίου",  "ΠΕ11", "Φυσικής Αγωγής",     "supervisor", "general",   now);
insT.run("Σοφία",      "Μακρή",          "ΠΕ80", "Οικονομολόγος",       "both",       "specialty", now);

sqlite.close();
console.log("[seed-local-db] Done ✓");
