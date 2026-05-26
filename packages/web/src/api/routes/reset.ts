import { Hono } from "hono";
import { seedFresh } from "../seed";

export const resetRoutes = new Hono()
  .post("/", async (c) => {
    await seedFresh();
    return c.json({ ok: true }, 200);
  });
