import { createClient } from "packages/web/node_modules/@libsql/client";
import { drizzle } from "packages/web/node_modules/drizzle-orm/libsql";
import * as schema from "./packages/web/src/api/database/schema";

const client = createClient({ url: "file:packages/web/local.db" });
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding...");

  // School
  const existingSchool = await db.select().from(schema.school);
  if (existingSchool.length === 0) {
    await db.insert(schema.school).values({
      name: "1ο ΕΠΑΛ Αθηνών",
      type: "ΕΠΑΛ",
      examStart: "2026-06-02",
      examEnd: "2026-06-20",
    });
    console.log("✓ School");
  } else {
    await db.update(schema.school).set({
      name: "1ο ΕΠΑΛ Αθηνών",
      type: "ΕΠΑΛ",
      examStart: "2026-06-02",
      examEnd: "2026-06-20",
    });
    console.log("✓ School (updated)");
  }

  // Shifts
  const existingShifts = await db.select().from(schema.shifts);
  if (existingShifts.length === 0) {
    await db.insert(schema.shifts).values([
      { name: "Α Βάρδια", startTime: "08:00", endTime: "14:00", durationMinutes: 120, order: 1 },
      { name: "Β Βάρδια", startTime: "14:10", endTime: "20:00", durationMinutes: 120, order: 2 },
    ]);
    console.log("✓ Shifts");
  }

  // Teachers
  const existingTeachers = await db.select().from(schema.teachers);
  let teacherIds: number[] = existingTeachers.map(t => t.id);

  if (existingTeachers.length === 0) {
    const inserted = await db.insert(schema.teachers).values([
      { firstName: "Ελένη",    lastName: "Παπαδοπούλου", specialty: "ΠΕ02", specialtyLabel: "Φιλόλογος",        role: "both",       isGeneralEducation: true },
      { firstName: "Γιώργος",  lastName: "Νικολάου",     specialty: "ΠΕ03", specialtyLabel: "Μαθηματικός",      role: "both",       isGeneralEducation: true },
      { firstName: "Μαρία",    lastName: "Κωνσταντίνου", specialty: "ΠΕ04", specialtyLabel: "Φυσικός",          role: "both",       isGeneralEducation: true },
      { firstName: "Δημήτρης", lastName: "Αλεξίου",      specialty: "ΠΕ17", specialtyLabel: "Ηλεκτρολόγος",    role: "both",       isGeneralEducation: false },
      { firstName: "Σοφία",    lastName: "Μιχαηλίδου",   specialty: "ΠΕ19", specialtyLabel: "Πληροφορικός",    role: "both",       isGeneralEducation: false },
      { firstName: "Κώστας",   lastName: "Παπαγεωργίου", specialty: "ΠΕ02", specialtyLabel: "Φιλόλογος",        role: "supervisor", isGeneralEducation: true },
      { firstName: "Νίκη",     lastName: "Ανδρέου",      specialty: "ΠΕ03", specialtyLabel: "Μαθηματικός",      role: "supervisor", isGeneralEducation: true },
      { firstName: "Πέτρος",   lastName: "Σταματίου",    specialty: "ΠΕ18", specialtyLabel: "Μηχανολόγος",     role: "both",       isGeneralEducation: false },
    ]).returning();
    teacherIds = inserted.map(t => t.id);
    console.log("✓ Teachers");
  }

  // Classes
  const existingClasses = await db.select().from(schema.classes);
  let classIds: Record<string, number> = {};

  if (existingClasses.length === 0) {
    const inserted = await db.insert(schema.classes).values([
      { grade: "Α", department: null,              label: "Α ΓΕΛ",          schoolType: "ΓΕΛ",  gradeOrder: 1 },
      { grade: "Β", department: null,              label: "Β ΓΕΛ",          schoolType: "ΓΕΛ",  gradeOrder: 2 },
      { grade: "Γ", department: null,              label: "Γ ΓΕΛ",          schoolType: "ΓΕΛ",  gradeOrder: 3 },
      { grade: "Α", department: "Πληροφορικής",   label: "Α Πληροφορικής", schoolType: "ΕΠΑΛ", gradeOrder: 1 },
      { grade: "Β", department: "Ηλεκτρολογίας",  label: "Β Ηλεκτρολογίας",schoolType: "ΕΠΑΛ", gradeOrder: 2 },
      { grade: "Γ", department: "Μηχανολογίας",   label: "Γ Μηχανολογίας", schoolType: "ΕΠΑΛ", gradeOrder: 3 },
    ]).returning();
    inserted.forEach(c => { classIds[c.label] = c.id; });
    console.log("✓ Classes");
  } else {
    existingClasses.forEach(c => { classIds[c.label] = c.id; });
  }

  // Subjects
  const existingSubjects = await db.select().from(schema.subjects);
  if (existingSubjects.length === 0 && Object.keys(classIds).length > 0) {
    const [t1, t2, t3, t4, t5] = teacherIds;
    await db.insert(schema.subjects).values([
      // Γ ΓΕΛ — highest priority
      { name: "Νεοελληνική Γλώσσα",     classId: classIds["Γ ΓΕΛ"],          presenterId: t1, subjectType: "general",   durationMinutes: 120, priority: 1 },
      { name: "Μαθηματικά",             classId: classIds["Γ ΓΕΛ"],          presenterId: t2, subjectType: "general",   durationMinutes: 120, priority: 1 },
      { name: "Φυσική",                 classId: classIds["Γ ΓΕΛ"],          presenterId: t3, subjectType: "general",   durationMinutes: 120, priority: 2 },
      { name: "Ιστορία",               classId: classIds["Γ ΓΕΛ"],          presenterId: t1, subjectType: "general",   durationMinutes: 120, priority: 2 },
      // Β ΓΕΛ
      { name: "Νεοελληνική Γλώσσα",     classId: classIds["Β ΓΕΛ"],          presenterId: t1, subjectType: "general",   durationMinutes: 120, priority: 3 },
      { name: "Μαθηματικά",             classId: classIds["Β ΓΕΛ"],          presenterId: t2, subjectType: "general",   durationMinutes: 120, priority: 3 },
      // Α ΓΕΛ
      { name: "Νεοελληνική Γλώσσα",     classId: classIds["Α ΓΕΛ"],          presenterId: t1, subjectType: "general",   durationMinutes: 120, priority: 4 },
      { name: "Μαθηματικά",             classId: classIds["Α ΓΕΛ"],          presenterId: t2, subjectType: "general",   durationMinutes: 120, priority: 4 },
      // ΕΠΑΛ
      { name: "Πληροφορική",            classId: classIds["Α Πληροφορικής"], presenterId: t5, subjectType: "specialty", durationMinutes: 180, priority: 2, specialty: "ΠΕ19" },
      { name: "Ηλεκτροτεχνία",         classId: classIds["Β Ηλεκτρολογίας"],presenterId: t4, subjectType: "specialty", durationMinutes: 180, priority: 2, specialty: "ΠΕ17" },
      { name: "Μηχανολογία",            classId: classIds["Γ Μηχανολογίας"], presenterId: t4 ? teacherIds[7] : t4, subjectType: "specialty", durationMinutes: 180, priority: 1, specialty: "ΠΕ18" },
    ]);
    console.log("✓ Subjects");
  }

  console.log("Done! Seed complete.");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
