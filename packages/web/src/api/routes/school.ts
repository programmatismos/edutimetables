import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";

export const schoolRoutes = new Hono()
  .get("/", async (c) => {
    const [s] = await db.select().from(schema.school).limit(1);
    return c.json({ school: s || null }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const existing = await db.select().from(schema.school).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(schema.school)
        .set({ ...body, updatedAt: new Date().toISOString() })
        .where(eq(schema.school.id, existing[0].id))
        .returning();
      return c.json({ school: updated }, 200);
    }
    const [created] = await db.insert(schema.school).values(body).returning();
    return c.json({ school: created }, 201);
  })
  .get("/unavailable", async (c) => {
    const rows = await db.select().from(schema.schoolUnavailable);
    return c.json({ unavailable: rows }, 200);
  })
  .post("/unavailable", async (c) => {
    const body = await c.req.json();
    const [row] = await db.insert(schema.schoolUnavailable).values(body).returning();
    return c.json({ unavailable: row }, 201);
  })
  .delete("/unavailable/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.schoolUnavailable).where(eq(schema.schoolUnavailable.id, id));
    return c.json({ ok: true }, 200);
  });
