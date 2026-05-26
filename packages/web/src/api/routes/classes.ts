import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, asc } from "drizzle-orm";

export const classesRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(schema.classes).orderBy(asc(schema.classes.gradeOrder), asc(schema.classes.label));
    return c.json({ classes: rows }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [row] = await db.insert(schema.classes).values(body).returning();
    return c.json({ class: row }, 201);
  })
  .put("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [row] = await db.update(schema.classes).set(body).where(eq(schema.classes.id, id)).returning();
    return c.json({ class: row }, 200);
  })
  .delete("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.classes).where(eq(schema.classes.id, id));
    return c.json({ ok: true }, 200);
  });
