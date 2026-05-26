import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, asc } from "drizzle-orm";

export const shiftsRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(schema.shifts).orderBy(asc(schema.shifts.order));
    return c.json({ shifts: rows }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [row] = await db.insert(schema.shifts).values(body).returning();
    return c.json({ shift: row }, 201);
  })
  .put("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [row] = await db.update(schema.shifts).set(body).where(eq(schema.shifts.id, id)).returning();
    return c.json({ shift: row }, 200);
  })
  .delete("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.shifts).where(eq(schema.shifts.id, id));
    return c.json({ ok: true }, 200);
  })
  .post("/seed-defaults", async (c) => {
    // Insert default shifts if none exist
    const existing = await db.select().from(schema.shifts);
    if (existing.length === 0) {
      await db.insert(schema.shifts).values([
        { name: "Α Βάρδια", startTime: "09:00", endTime: "11:00", durationMinutes: 120, order: 1 },
        { name: "Β Βάρδια", startTime: "11:00", endTime: "13:00", durationMinutes: 120, order: 2 },
      ]);
    }
    const rows = await db.select().from(schema.shifts).orderBy(asc(schema.shifts.order));
    return c.json({ shifts: rows }, 200);
  });
