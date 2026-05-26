import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { runScheduler } from "../scheduler/algorithm";
import { eq } from "drizzle-orm";

export const generateRoutes = new Hono()
  .post("/", async (c) => {
    try {
      // Load all data
      const [schoolData] = await db.select().from(schema.school).limit(1);
      if (!schoolData) return c.json({ error: "Δεν έχουν οριστεί στοιχεία σχολείου" }, 400);

      const shifts = await db.select().from(schema.shifts);
      if (shifts.length === 0) return c.json({ error: "Δεν έχουν οριστεί βάρδιες" }, 400);

      const schoolUnavail = await db.select().from(schema.schoolUnavailable);
      const teachers = await db.select().from(schema.teachers);
      const teacherUnavail = await db.select().from(schema.teacherUnavailable);
      const classes = await db.select().from(schema.classes);
      const subjects = await db.select().from(schema.subjects);
      const teacherList = await db.select().from(schema.teachers);

      // Enrich subjects
      const enrichedSubjects = subjects.map((s) => ({
        ...s,
        class: classes.find((cl) => cl.id === s.classId) || null,
        presenter: teacherList.find((t) => t.id === s.presenterId) || null,
      }));

      // Parse request body
      const body = await c.req.json().catch(() => ({}));
      const splitThreshold = body.splitThreshold ?? 25;

      const result = runScheduler({
        school: schoolData,
        shifts,
        schoolUnavailable: schoolUnavail,
        teachers,
        teacherUnavailable: teacherUnavail,
        subjects: enrichedSubjects,
        splitThreshold,
      });

      // Clear existing schedule
      const clearAll = body.clearManual ?? true;
      if (clearAll) {
        await db.delete(schema.examSchedule);
      } else {
        // Only delete auto-placed slots
        const existing = await db.select().from(schema.examSchedule);
        for (const e of existing) {
          if (!e.isManuallyPlaced) {
            await db.delete(schema.examSchedule).where(eq(schema.examSchedule.id, e.id));
          }
        }
      }

      // Insert new slots — split subjects get 2 parallel entries
      for (const slot of result.slots) {
        if (slot.isSplit && slot.supervisorIds.length >= 2) {
          // Split: 2 entries with 1 supervisor each (same time/shift)
          const [sup1, sup2] = slot.supervisorIds;
          await db.insert(schema.examSchedule).values({
            subjectId: slot.subjectId,
            date: slot.date,
            shiftId: slot.shiftId,
            presenterId: slot.presenterId,
            supervisorIds: JSON.stringify([sup1]),
            isManuallyPlaced: false,
            notes: "Τμήμα Α (split)",
            updatedAt: new Date().toISOString(),
          });
          await db.insert(schema.examSchedule).values({
            subjectId: slot.subjectId,
            date: slot.date,
            shiftId: slot.shiftId,
            presenterId: null, // 2ο τμήμα χωρίς εισηγητή (ή ίδιος)
            supervisorIds: JSON.stringify([sup2]),
            isManuallyPlaced: false,
            notes: "Τμήμα Β (split)",
            updatedAt: new Date().toISOString(),
          });
        } else {
          await db.insert(schema.examSchedule).values({
            subjectId: slot.subjectId,
            date: slot.date,
            shiftId: slot.shiftId,
            presenterId: slot.presenterId,
            supervisorIds: JSON.stringify(slot.supervisorIds),
            isManuallyPlaced: false,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Log run
      await db.insert(schema.scheduleRuns).values({
        score: result.score,
        violations: JSON.stringify(result.violations),
        status: result.unscheduled.length === 0 ? "success" : "failed",
      });

      return c.json({
        ok: true,
        placed: result.slots.length,
        unscheduled: result.unscheduled,
        violations: result.violations,
        score: result.score,
      }, 200);
    } catch (err: any) {
      return c.json({ error: err.message || "Σφάλμα κατά τη δημιουργία προγράμματος" }, 500);
    }
  });
