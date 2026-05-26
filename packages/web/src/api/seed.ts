/**
 * Default fixtures.
 * - seedIfEmpty(): inserts only if all tables empty (called on startup)
 * - seedFresh():   wipes everything then inserts (called by /api/reset)
 *
 * For Electron (better-sqlite3) we use raw sync SQL so there are no
 * async/await issues with the synchronous driver.
 * For web/Turso we use drizzle async as before.
 */

import { db, getRawSqlite } from "./database";
import * as schema from "./database/schema";
import { initDb } from "./database/init";

// ─── Sync seed (Electron / better-sqlite3) ────────────────────────────────────

function seedSync(sqlite: any) {
  // Wipe in FK-safe order
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
  const insertSubject = sqlite.prepare(`
    INSERT INTO subjects (name, class_id, subject_type, duration_minutes, priority, specialty)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Α ΓΕΛ
  insertSubject.run("Νέα Ελληνική Γλώσσα & Λογοτεχνία", cA, "general", 120, 1, null);
  insertSubject.run("Ιστορία",                            cA, "general", 120, 2, null);
  insertSubject.run("Μαθηματικά Ι",                       cA, "general", 120, 2, null);
  insertSubject.run("Βιολογία",                           cA, "general", 120, 3, null);
  insertSubject.run("Φυσική",                             cA, "general", 120, 3, null);
  insertSubject.run("Χημεία",                             cA, "general", 120, 3, null);
  insertSubject.run("Αρχαία Ελληνική Γλώσσα",             cA, "general", 120, 4, null);
  insertSubject.run("Αγγλικά",                            cA, "general", 120, 5, null);

  // Β ΓΕΛ
  insertSubject.run("Νέα Ελληνική Γλώσσα & Λογοτεχνία", cB, "general", 120, 1, null);
  insertSubject.run("Ιστορία",                            cB, "general", 120, 2, null);
  insertSubject.run("Μαθηματικά ΙΙ",                      cB, "general", 120, 2, null);
  insertSubject.run("Βιολογία",                           cB, "general", 120, 3, null);
  insertSubject.run("Φυσική",                             cB, "general", 120, 3, null);
  insertSubject.run("Χημεία",                             cB, "general", 120, 3, null);
  insertSubject.run("Αρχαία Ελληνική Γλώσσα",             cB, "general", 120, 4, null);
  insertSubject.run("Αγγλικά",                            cB, "general", 120, 5, null);

  // Γ ΓΕΛ
  insertSubject.run("Νέα Ελληνική Γλώσσα & Λογοτεχνία",    cG, "general",   120, 1, null);
  insertSubject.run("Ιστορία",                              cG, "general",   120, 1, null);
  insertSubject.run("Μαθηματικά",                           cG, "general",   120, 2, null);
  insertSubject.run("Βιολογία",                             cG, "general",   120, 2, null);
  insertSubject.run("Φυσική",                               cG, "general",   120, 2, null);
  insertSubject.run("Χημεία",                               cG, "general",   120, 2, null);
  insertSubject.run("Αρχαία Ελληνική Γλώσσα & Γραμματεία", cG, "general",   120, 3, null);
  insertSubject.run("Αγγλικά",                              cG, "general",   120, 4, null);
  insertSubject.run("Αρχές Οικονομικής Θεωρίας",            cG, "specialty", 180, 1, "ΠΕ80");
  insertSubject.run("Λογιστική - Χρηματοοικονομική",        cG, "specialty", 180, 1, "ΠΕ80");

  // Teachers
  const insertTeacher = sqlite.prepare(`
    INSERT INTO teachers (first_name, last_name, specialty, specialty_label, role, education_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  insertTeacher.run("Παναγιώτης", "Παπαδόπουλος", "ΠΕ02", "Φιλόλογος",           "both",       "general",   now);
  insertTeacher.run("Μαρία",      "Νικολάου",      "ΠΕ03", "Μαθηματικός",         "both",       "general",   now);
  insertTeacher.run("Δημήτρης",   "Αντωνίου",      "ΠΕ04", "Φυσικός",             "both",       "general",   now);
  insertTeacher.run("Ελένη",      "Κωνσταντίνου",  "ΠΕ04", "Χημικός",             "both",       "general",   now);
  insertTeacher.run("Γιώργος",    "Σταματίου",     "ΠΕ06", "Αγγλικής Φιλολογίας", "both",       "general",   now);
  insertTeacher.run("Αικατερίνη", "Δημητρίου",     "ΠΕ01", "Θεολόγος",            "supervisor", "general",   now);
  insertTeacher.run("Νικόλαος",   "Παπαγεωργίου",  "ΠΕ11", "Φυσικής Αγωγής",     "supervisor", "general",   now);
  insertTeacher.run("Σοφία",      "Μακρή",          "ΠΕ80", "Οικονομολόγος",       "both",       "specialty", now);

  console.log("[seed] Sync seed complete ✓");
}

// ─── Async seed (Turso / libsql) ─────────────────────────────────────────────

async function insertDefaults() {
  await db.insert(schema.school).values({
    name: "1ο ΓΕΛ Πόλης",
    type: "ΓΕΛ",
    examStart: null,
    examEnd: null,
  });

  await db.insert(schema.shifts).values([
    { name: "Α Βάρδια (Πρωινή)",      startTime: "09:00", endTime: "11:00", durationMinutes: 120, order: 1 },
    { name: "Β Βάρδια (Μεσημβρινή)", startTime: "11:00", endTime: "13:00", durationMinutes: 120, order: 2 },
  ]);

  const insertedClasses = await db.insert(schema.classes).values([
    { grade: "Α", department: null, label: "Α ΓΕΛ", schoolType: "ΓΕΛ", gradeOrder: 1, studentCount: 25, forceSplit: false },
    { grade: "Β", department: null, label: "Β ΓΕΛ", schoolType: "ΓΕΛ", gradeOrder: 2, studentCount: 25, forceSplit: false },
    { grade: "Γ", department: null, label: "Γ ΓΕΛ", schoolType: "ΓΕΛ", gradeOrder: 3, studentCount: 25, forceSplit: false },
  ]).returning();

  const [classA, classB, classG] = insertedClasses;

  await db.insert(schema.subjects).values([
    { name: "Νέα Ελληνική Γλώσσα & Λογοτεχνία", classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 1 },
    { name: "Ιστορία",                            classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 2 },
    { name: "Μαθηματικά Ι",                       classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 2 },
    { name: "Βιολογία",                           classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 3 },
    { name: "Φυσική",                             classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 3 },
    { name: "Χημεία",                             classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 3 },
    { name: "Αρχαία Ελληνική Γλώσσα",             classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 4 },
    { name: "Αγγλικά",                            classId: classA.id, subjectType: "general", durationMinutes: 120, priority: 5 },

    { name: "Νέα Ελληνική Γλώσσα & Λογοτεχνία", classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 1 },
    { name: "Ιστορία",                            classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 2 },
    { name: "Μαθηματικά ΙΙ",                      classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 2 },
    { name: "Βιολογία",                           classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 3 },
    { name: "Φυσική",                             classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 3 },
    { name: "Χημεία",                             classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 3 },
    { name: "Αρχαία Ελληνική Γλώσσα",             classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 4 },
    { name: "Αγγλικά",                            classId: classB.id, subjectType: "general", durationMinutes: 120, priority: 5 },

    { name: "Νέα Ελληνική Γλώσσα & Λογοτεχνία",    classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 1 },
    { name: "Ιστορία",                              classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 1 },
    { name: "Μαθηματικά",                           classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Βιολογία",                             classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Φυσική",                               classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Χημεία",                               classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Αρχαία Ελληνική Γλώσσα & Γραμματεία", classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 3 },
    { name: "Αγγλικά",                              classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 4 },
    { name: "Αρχές Οικονομικής Θεωρίας",            classId: classG.id, subjectType: "specialty", durationMinutes: 180, priority: 1, specialty: "ΠΕ80" },
    { name: "Λογιστική - Χρηματοοικονομική",        classId: classG.id, subjectType: "specialty", durationMinutes: 180, priority: 1, specialty: "ΠΕ80" },
  ]);

  await db.insert(schema.teachers).values([
    { firstName: "Παναγιώτης", lastName: "Παπαδόπουλος", specialty: "ΠΕ02", specialtyLabel: "Φιλόλογος",           role: "both",       educationType: "general"   },
    { firstName: "Μαρία",      lastName: "Νικολάου",      specialty: "ΠΕ03", specialtyLabel: "Μαθηματικός",         role: "both",       educationType: "general"   },
    { firstName: "Δημήτρης",   lastName: "Αντωνίου",      specialty: "ΠΕ04", specialtyLabel: "Φυσικός",             role: "both",       educationType: "general"   },
    { firstName: "Ελένη",      lastName: "Κωνσταντίνου",  specialty: "ΠΕ04", specialtyLabel: "Χημικός",             role: "both",       educationType: "general"   },
    { firstName: "Γιώργος",    lastName: "Σταματίου",     specialty: "ΠΕ06", specialtyLabel: "Αγγλικής Φιλολογίας", role: "both",       educationType: "general"   },
    { firstName: "Αικατερίνη", lastName: "Δημητρίου",     specialty: "ΠΕ01", specialtyLabel: "Θεολόγος",            role: "supervisor", educationType: "general"   },
    { firstName: "Νικόλαος",   lastName: "Παπαγεωργίου",  specialty: "ΠΕ11", specialtyLabel: "Φυσικής Αγωγής",     role: "supervisor", educationType: "general"   },
    { firstName: "Σοφία",      lastName: "Μακρή",          specialty: "ΠΕ80", specialtyLabel: "Οικονομολόγος",       role: "both",       educationType: "specialty" },
  ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function seedFresh() {
  try {
    console.log("[seed] seedFresh: resetting…");
    const sqlite = getRawSqlite();
    if (sqlite) {
      // Electron: use raw sync SQL — no async issues
      seedSync(sqlite);
    } else {
      // Turso: async drizzle
      await db.delete(schema.examSchedule);
      await db.delete(schema.scheduleRuns);
      await db.delete(schema.subjects);
      await db.delete(schema.teacherUnavailable);
      await db.delete(schema.teachers);
      await db.delete(schema.classes);
      await db.delete(schema.schoolUnavailable);
      await db.delete(schema.shifts);
      await db.delete(schema.school);
      await insertDefaults();
    }
    console.log("[seed] seedFresh complete ✓");
  } catch (err) {
    console.error("[seed] seedFresh failed:", err);
    throw err;
  }
}

export async function seedIfEmpty() {
  try {
    const [existingSchool] = await db.select().from(schema.school).limit(1);
    const [existingShift]  = await db.select().from(schema.shifts).limit(1);
    if (existingSchool || existingShift) return;

    console.log("[seed] Empty DB — inserting defaults…");
    const sqlite = getRawSqlite();
    if (sqlite) {
      seedSync(sqlite);
    } else {
      await insertDefaults();
    }
  } catch (err) {
    console.error("[seed] seedIfEmpty failed:", err);
  }
}
