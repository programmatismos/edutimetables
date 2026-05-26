import { Hono } from "hono";
import { cors } from "hono/cors";
import { schoolRoutes } from "./routes/school";
import { shiftsRoutes } from "./routes/shifts";
import { teachersRoutes } from "./routes/teachers";
import { classesRoutes } from "./routes/classes";
import { subjectsRoutes } from "./routes/subjects";
import { scheduleRoutes } from "./routes/schedule";
import { generateRoutes } from "./routes/generate";
import { resetRoutes } from "./routes/reset";
import { seedIfEmpty } from "./seed";

// Run seed on startup (no-op if data already exists)
seedIfEmpty();

const app = new Hono()
  .basePath("api")
  .use(cors({ origin: "*" }))
  .onError((err, c) => {
    console.error("[API Error]", err);
    return c.json({ error: err.message || "Internal server error", stack: err.stack }, 500);
  })
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .route("/school", schoolRoutes)
  .route("/shifts", shiftsRoutes)
  .route("/teachers", teachersRoutes)
  .route("/classes", classesRoutes)
  .route("/subjects", subjectsRoutes)
  .route("/schedule", scheduleRoutes)
  .route("/generate", generateRoutes)
  .route("/reset", resetRoutes);

export type AppType = typeof app;
export default app;
