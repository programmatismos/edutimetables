import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, gte, lte } from "drizzle-orm";

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
      const supervisorIds: number[] = JSON.parse(row.supervisorIds || "[]");
      const supervisors = supervisorIds.map((id) => teachers.find((t) => t.id === id)).filter(Boolean);
      return { ...row, subject, class: cls, presenter, shift, supervisors };
    });
    return c.json({ schedule: enriched }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [row] = await db.insert(schema.examSchedule).values({
      ...body,
      supervisorIds: JSON.stringify(body.supervisorIds || []),
      updatedAt: new Date().toISOString(),
    }).returning();
    return c.json({ slot: row }, 201);
  })
  .put("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const updateData = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    if (body.supervisorIds !== undefined) {
      updateData.supervisorIds = JSON.stringify(body.supervisorIds);
    }
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
