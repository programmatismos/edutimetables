import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, asc } from "drizzle-orm";

export const subjectsRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(schema.subjects).orderBy(asc(schema.subjects.name));
    // Join class info
    const classes = await db.select().from(schema.classes);
    const teachers = await db.select().from(schema.teachers);
    const enriched = rows.map((s) => ({
      ...s,
      class: classes.find((cl) => cl.id === s.classId) || null,
      presenter: teachers.find((t) => t.id === s.presenterId) || null,
    }));
    return c.json({ subjects: enriched }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [row] = await db.insert(schema.subjects).values(body).returning();
    return c.json({ subject: row }, 201);
  })
  .put("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [row] = await db.update(schema.subjects).set(body).where(eq(schema.subjects.id, id)).returning();
    return c.json({ subject: row }, 200);
  })
  .delete("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.subjects).where(eq(schema.subjects.id, id));
    return c.json({ ok: true }, 200);
  })
  .post("/import", async (c) => {
    const body = await c.req.json();
    const { subjects: list } = body;
    const inserted = await db.insert(schema.subjects).values(list).returning();
    return c.json({ subjects: inserted, count: inserted.length }, 201);
  });
