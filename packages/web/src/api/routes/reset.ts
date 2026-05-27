import { Hono } from "hono";
import { seedFresh } from "../seed";

export const resetRoutes = new Hono()
  .post("/", async (c) => {
    try {
      await seedFresh();
      return c.json({ ok: true }, 200);
    } catch (err: any) {
      console.error("[reset] failed:", err);
      return c.json({ error: err?.message ?? String(err) }, 500);
    }
  });
