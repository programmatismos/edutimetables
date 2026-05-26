import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, asc } from "drizzle-orm";

export const teachersRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(schema.teachers).orderBy(asc(schema.teachers.lastName));
    return c.json({ teachers: rows }, 200);
  })
  // Οι στατικές διαδρομές μπαίνουν πριν από το "/:id", αλλιώς ο Hono router
  // μπορεί να διαβάσει το "import" σαν ID καθηγητή και να επιστρέψει λάθος route.
  .post("/import", async (c) => {
    const body = await c.req.json();
    const { teachers: list } = body;
    const sanitized = list.map((t: any) => ({ ...t, specialty: t.specialty || "ΠΕ00" }));
    const inserted = await db.insert(schema.teachers).values(sanitized).returning();
    return c.json({ teachers: inserted, count: inserted.length }, 201);
  })
  // All teacher unavailabilities (for schedule conflict detection)
  // Χρησιμοποιείται από το πρόγραμμα για να ελέγχει συγκρούσεις σε όλες τις
  // επιτηρήσεις, όχι μόνο για έναν συγκεκριμένο καθηγητή.
  .get("/all-unavailable", async (c) => {
    const rows = await db.select().from(schema.teacherUnavailable);
    return c.json({ unavailable: rows }, 200);
  })
  .get("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const [row] = await db.select().from(schema.teachers).where(eq(schema.teachers.id, id));
    if (!row) return c.json({ error: "Not found" }, 404);
    const unavailable = await db.select().from(schema.teacherUnavailable)
      .where(eq(schema.teacherUnavailable.teacherId, id));
    return c.json({ teacher: row, unavailable }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const data = { ...body, specialty: body.specialty || "ΠΕ00" };
    const [row] = await db.insert(schema.teachers).values(data).returning();
    return c.json({ teacher: row }, 201);
  })
  .put("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const data = { ...body };
    if (!data.specialty) data.specialty = "ΠΕ00";
    const [row] = await db.update(schema.teachers).set(data).where(eq(schema.teachers.id, id)).returning();
    return c.json({ teacher: row }, 200);
  })
  .delete("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.teachers).where(eq(schema.teachers.id, id));
    return c.json({ ok: true }, 200);
  })
  // Unavailability
  .get("/:id/unavailable", async (c) => {
    const teacherId = parseInt(c.req.param("id"));
    const rows = await db.select().from(schema.teacherUnavailable)
      .where(eq(schema.teacherUnavailable.teacherId, teacherId));
    return c.json({ unavailable: rows }, 200);
  })
  .post("/:id/unavailable", async (c) => {
    const teacherId = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [row] = await db.insert(schema.teacherUnavailable)
      .values({ ...body, teacherId }).returning();
    return c.json({ unavailable: row }, 201);
  })
  .delete("/:id/unavailable/:uid", async (c) => {
    const uid = parseInt(c.req.param("uid"));
    await db.delete(schema.teacherUnavailable).where(eq(schema.teacherUnavailable.id, uid));
    return c.json({ ok: true }, 200);
  });
