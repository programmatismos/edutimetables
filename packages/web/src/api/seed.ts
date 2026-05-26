/**
 * Default fixtures — inserted once when the DB is empty.
 * Called from api/index.ts on startup.
 *
 * seedFresh() — διαγράφει ΟΛΑ τα δεδομένα και ξανατρέχει το seed.
 */

import { db } from "./database";
import * as schema from "./database/schema";

async function insertDefaults() {
  // ── Σχολείο ───────────────────────────────────────────────────────────────
  await db.insert(schema.school).values({
    name: "1ο ΓΕΛ Πόλης",
    type: "ΓΕΛ",
    examStart: null,
    examEnd: null,
  });

  // ── Βάρδιες ───────────────────────────────────────────────────────────────
  await db.insert(schema.shifts).values([
    { name: "Α Βάρδια (Πρωινή)",      startTime: "09:00", endTime: "11:00", durationMinutes: 120, order: 1 },
    { name: "Β Βάρδια (Μεσημβρινή)", startTime: "11:00", endTime: "13:00", durationMinutes: 120, order: 2 },
  ]);

  // ── Τάξεις ΓΕΛ ───────────────────────────────────────────────────────────
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

    { name: "Νέα Ελληνική Γλώσσα & Λογοτεχνία",  classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 1 },
    { name: "Ιστορία",                            classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 1 },
    { name: "Μαθηματικά",                         classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Βιολογία",                           classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Φυσική",                             classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Χημεία",                             classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 2 },
    { name: "Αρχαία Ελληνική Γλώσσα & Γραμματεία", classId: classG.id, subjectType: "general", durationMinutes: 120, priority: 3 },
    { name: "Αγγλικά",                            classId: classG.id, subjectType: "general",   durationMinutes: 120, priority: 4 },
    { name: "Αρχές Οικονομικής Θεωρίας",          classId: classG.id, subjectType: "specialty", durationMinutes: 180, priority: 1, specialty: "ΠΕ80" },
    { name: "Λογιστική - Χρηματοοικονομική",      classId: classG.id, subjectType: "specialty", durationMinutes: 180, priority: 1, specialty: "ΠΕ80" },
  ]);

  await db.insert(schema.teachers).values([
    { firstName: "Παναγιώτης", lastName: "Παπαδόπουλος", specialty: "ΠΕ02", specialtyLabel: "Φιλόλογος",           role: "both",       educationType: "general" },
    { firstName: "Μαρία",      lastName: "Νικολάου",      specialty: "ΠΕ03", specialtyLabel: "Μαθηματικός",         role: "both",       educationType: "general" },
    { firstName: "Δημήτρης",   lastName: "Αντωνίου",      specialty: "ΠΕ04", specialtyLabel: "Φυσικός",             role: "both",       educationType: "general" },
    { firstName: "Ελένη",      lastName: "Κωνσταντίνου",  specialty: "ΠΕ04", specialtyLabel: "Χημικός",             role: "both",       educationType: "general" },
    { firstName: "Γιώργος",    lastName: "Σταματίου",     specialty: "ΠΕ06", specialtyLabel: "Αγγλικής Φιλολογίας", role: "both",       educationType: "general" },
    { firstName: "Αικατερίνη", lastName: "Δημητρίου",     specialty: "ΠΕ01", specialtyLabel: "Θεολόγος",            role: "supervisor", educationType: "general" },
    { firstName: "Νικόλαος",   lastName: "Παπαγεωργίου",  specialty: "ΠΕ11", specialtyLabel: "Φυσικής Αγωγής",     role: "supervisor", educationType: "general" },
    { firstName: "Σοφία",      lastName: "Μακρή",          specialty: "ΠΕ80", specialtyLabel: "Οικονομολόγος",       role: "both",       educationType: "specialty" },
  ]);
}

export async function seedFresh() {
  try {
    console.log("[seed] Resetting DB and inserting default fixtures…");
    // Διαγράφω με σειρά (foreign keys)
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
    console.log("[seed] Reset complete ✓");
  } catch (err) {
    console.error("[seed] Reset failed:", err);
    throw err;
  }
}

export async function seedIfEmpty() {
  try {
    // ── Guard: only seed if ALL main tables are empty ─────────────────────────
    const [existingSchool] = await db.select().from(schema.school).limit(1);
    const [existingShift]  = await db.select().from(schema.shifts).limit(1);
    if (existingSchool || existingShift) return; // already seeded

    console.log("[seed] Empty DB detected — inserting default fixtures…");
    await insertDefaults();
    console.log("[seed] Default fixtures inserted ✓");
  } catch (err) {
    console.error("[seed] Failed to insert fixtures:", err);
  }
}
