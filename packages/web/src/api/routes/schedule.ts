import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";

type ScheduleRow = typeof schema.examSchedule.$inferSelect;
type NormalizedSchedulePayload = Partial<typeof schema.examSchedule.$inferInsert>;

// Μετατρέπουμε κάθε τιμή ID σε θετικό ακέραιο ή null.
// Αυτό είναι σημαντικό γιατί η φόρμα στέλνει συχνά strings ή το 0 ως
// "χωρίς εισηγητή", ενώ η βάση περιμένει είτε πραγματικό foreign key είτε null.
function toPositiveInteger(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Διαβάζουμε τους επιτηρητές αν έρθουν είτε ως array από το frontend είτε ως
// JSON string από αποθηκευμένη γραμμή. Αν η βάση έχει χαλασμένο JSON, δεν
// ρίχνουμε όλο το endpoint. Απλά επιστρέφουμε κενή λίστα για ασφαλή προβολή.
function parseSupervisorIds(value: unknown): number[] {
  const values = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || value.length === 0) return [];

    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return [...new Set(values
    .map(toPositiveInteger)
    .filter((id): id is number => id !== null))];
}

// Κανονικοποιούμε μόνο τα πεδία που γνωρίζει ο πίνακας schedule.
// Έτσι αποφεύγουμε να περάσουν εμπλουτισμένα frontend-only αντικείμενα
// όπως subject/class/presenter προς το Drizzle insert/update.
function normalizeSchedulePayload(body: any): NormalizedSchedulePayload {
  const data: NormalizedSchedulePayload = { updatedAt: new Date().toISOString() };

  if ("subjectId" in body) {
    const subjectId = toPositiveInteger(body.subjectId);
    if (subjectId) data.subjectId = subjectId;
  }

  if ("date" in body && typeof body.date === "string") {
    data.date = body.date;
  }

  if ("shiftId" in body) {
    const shiftId = toPositiveInteger(body.shiftId);
    if (shiftId) data.shiftId = shiftId;
  }

  if ("presenterId" in body) {
    data.presenterId = toPositiveInteger(body.presenterId);
  }

  if (body.supervisorIds !== undefined) {
    data.supervisorIds = JSON.stringify(parseSupervisorIds(body.supervisorIds));
  }

  if ("isManuallyPlaced" in body) {
    data.isManuallyPlaced = Boolean(body.isManuallyPlaced);
  }

  if ("notes" in body) {
    data.notes = typeof body.notes === "string" ? body.notes : null;
  }

  return data;
}

function hasSplitNote(slot: Pick<ScheduleRow, "notes"> | NormalizedSchedulePayload): boolean {
  return typeof slot.notes === "string" && slot.notes.toLowerCase().includes("split");
}

// Οι split εξετάσεις αποθηκεύονται ως δύο παράλληλες γραμμές για το ίδιο μάθημα,
// την ίδια ημερομηνία και την ίδια βάρδια. Αυτές οι δύο γραμμές είναι σκόπιμες
// και δεν πρέπει να θεωρούνται σύγκρουση ίδιας τάξης.
function isSplitPair(a: Pick<ScheduleRow, "subjectId" | "date" | "shiftId" | "notes">, b: Pick<ScheduleRow, "subjectId" | "date" | "shiftId" | "notes">): boolean {
  return a.subjectId === b.subjectId &&
    a.date === b.date &&
    a.shiftId === b.shiftId &&
    hasSplitNote(a) &&
    hasSplitNote(b);
}

function isTeacherUnavailable(
  teacherId: number,
  date: string,
  shiftId: number,
  unavailable: Array<typeof schema.teacherUnavailable.$inferSelect>,
): boolean {
  return unavailable.some((u) =>
    u.teacherId === teacherId &&
    u.date === date &&
    (u.shiftId === null || u.shiftId === shiftId)
  );
}

// Κεντρικός έλεγχος ασφαλείας για χειροκίνητες προσθήκες/αλλαγές.
// Η UI ήδη δείχνει προειδοποιήσεις, όμως το API πρέπει να απορρίπτει τα ίδια
// λάθη ώστε να μην αποθηκευτεί άκυρο πρόγραμμα από άλλη κλήση ή παλιό client.
async function validateSchedulePayload(
  payload: NormalizedSchedulePayload,
  existingId?: number,
): Promise<string[]> {
  const issues: string[] = [];

  const subjectId = toPositiveInteger(payload.subjectId);
  const shiftId = toPositiveInteger(payload.shiftId);
  const presenterId = toPositiveInteger(payload.presenterId);
  const date = typeof payload.date === "string" ? payload.date : "";
  const supervisorIds = parseSupervisorIds(payload.supervisorIds);

  if (!subjectId) issues.push("Δεν έχει οριστεί έγκυρο μάθημα.");
  if (!shiftId) issues.push("Δεν έχει οριστεί έγκυρη βάρδια.");
  if (!date) issues.push("Δεν έχει οριστεί ημερομηνία.");
  if (issues.length > 0 || !subjectId || !shiftId || !date) return issues;

  const [subject] = await db.select().from(schema.subjects).where(eq(schema.subjects.id, subjectId));
  if (!subject) return ["Το μάθημα δεν υπάρχει."];

  const [shift] = await db.select().from(schema.shifts).where(eq(schema.shifts.id, shiftId));
  if (!shift) issues.push("Η βάρδια δεν υπάρχει.");

  const [schoolUnavailable] = await db.select().from(schema.schoolUnavailable).where(eq(schema.schoolUnavailable.date, date));
  if (schoolUnavailable) issues.push("Η ημερομηνία είναι δηλωμένη ως μη διαθέσιμη για το σχολείο.");

  const teachers = await db.select().from(schema.teachers);
  if (presenterId && !teachers.some((t) => t.id === presenterId)) {
    issues.push("Ο εισηγητής δεν υπάρχει.");
  }

  for (const supervisorId of supervisorIds) {
    if (!teachers.some((t) => t.id === supervisorId)) {
      issues.push(`Ο επιτηρητής με ID ${supervisorId} δεν υπάρχει.`);
    }
  }

  if (presenterId && supervisorIds.includes(presenterId)) {
    issues.push("Ο εισηγητής δεν μπορεί να είναι ταυτόχρονα επιτηρητής στην ίδια εξέταση.");
  }

  const teacherUnavailable = await db.select().from(schema.teacherUnavailable);
  if (presenterId && isTeacherUnavailable(presenterId, date, shiftId, teacherUnavailable)) {
    issues.push("Ο εισηγητής έχει δηλώσει αδυναμία για αυτή την ημερομηνία/βάρδια.");
  }

  for (const supervisorId of supervisorIds) {
    if (isTeacherUnavailable(supervisorId, date, shiftId, teacherUnavailable)) {
      issues.push(`Ο επιτηρητής με ID ${supervisorId} έχει δηλώσει αδυναμία για αυτή την ημερομηνία/βάρδια.`);
    }
  }

  const rows = await db.select().from(schema.examSchedule);
  const allSubjects = await db.select().from(schema.subjects);
  const candidate = {
    id: existingId ?? -1,
    subjectId,
    date,
    shiftId,
    presenterId,
    supervisorIds: JSON.stringify(supervisorIds),
    notes: typeof payload.notes === "string" ? payload.notes : null,
  };

  for (const row of rows) {
    if (existingId && row.id === existingId) continue;
    const sameShift = row.date === date && row.shiftId === shiftId;
    const otherSubject = allSubjects.find((s) => s.id === row.subjectId);
    const splitPair = isSplitPair(candidate, row);

    if (otherSubject && otherSubject.classId === subject.classId && row.date === date && !splitPair) {
      issues.push("Η τάξη έχει ήδη εξέταση την ίδια ημέρα.");
    }

    if (otherSubject && otherSubject.classId === subject.classId && sameShift && !splitPair) {
      issues.push("Η τάξη έχει ήδη εξέταση στην ίδια βάρδια.");
    }

    const otherSupervisorIds = parseSupervisorIds(row.supervisorIds);
    if (sameShift && presenterId && row.presenterId === presenterId) {
      issues.push("Ο εισηγητής έχει ήδη άλλη εξέταση στην ίδια βάρδια.");
    }

    if (sameShift && presenterId && otherSupervisorIds.includes(presenterId)) {
      issues.push("Ο εισηγητής είναι ήδη επιτηρητής σε άλλη εξέταση της ίδιας βάρδιας.");
    }

    for (const supervisorId of supervisorIds) {
      if (sameShift && row.presenterId === supervisorId) {
        issues.push(`Ο επιτηρητής με ID ${supervisorId} είναι εισηγητής σε άλλη εξέταση της ίδιας βάρδιας.`);
      }

      if (sameShift && otherSupervisorIds.includes(supervisorId)) {
        issues.push(`Ο επιτηρητής με ID ${supervisorId} επιτηρεί ήδη άλλη εξέταση της ίδιας βάρδιας.`);
      }
    }
  }

  return [...new Set(issues)];
}

export const scheduleRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(schema.examSchedule);
    const subjects = await db.select().from(schema.subjects);
    const classes = await db.select().from(schema.classes);
    const teachers = await db.select().from(schema.teachers);
    const shifts = await db.select().from(schema.shifts);

    const enriched = rows.map((row) => {
      const subject = subjects.find((s) => s.id === row.subjectId);
      const cls = subject ? classes.find((c) => c.id === subject.classId) : null;
      const presenter = teachers.find((t) => t.id === row.presenterId);
      const shift = shifts.find((s) => s.id === row.shiftId);
      const supervisorIds = parseSupervisorIds(row.supervisorIds);
      const supervisors = supervisorIds.map((id) => teachers.find((t) => t.id === id)).filter(Boolean);
      return { ...row, subject, class: cls, presenter, shift, supervisors };
    });
    return c.json({ schedule: enriched }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const payload = normalizeSchedulePayload(body);
    const issues = await validateSchedulePayload(payload);
    if (issues.length > 0) return c.json({ error: "Άκυρη τοποθέτηση εξέτασης", issues }, 400);

    const [row] = await db.insert(schema.examSchedule).values(payload).returning();
    return c.json({ slot: row }, 201);
  })
  .put("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const updateData = normalizeSchedulePayload(body);
    const [existing] = await db.select().from(schema.examSchedule).where(eq(schema.examSchedule.id, id));
    if (!existing) return c.json({ error: "Not found" }, 404);

    // Στο update μπορεί να αλλάζει μόνο ένα μέρος της γραμμής, οπότε ελέγχουμε
    // το τελικό αποτέλεσμα μετά τη συγχώνευση παλιών και νέων τιμών.
    const mergedPayload = { ...existing, ...updateData };
    const issues = await validateSchedulePayload(mergedPayload, id);
    if (issues.length > 0) return c.json({ error: "Άκυρη τοποθέτηση εξέτασης", issues }, 400);

    const [row] = await db.update(schema.examSchedule).set(updateData)
      .where(eq(schema.examSchedule.id, id)).returning();
    return c.json({ slot: row }, 200);
  })
  .delete("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.examSchedule).where(eq(schema.examSchedule.id, id));
    return c.json({ ok: true }, 200);
  })
  .delete("/", async (c) => {
    await db.delete(schema.examSchedule);
    return c.json({ ok: true }, 200);
  });
