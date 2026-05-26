import { Hono } from "hono";
import { cors } from "hono/cors";
import { schoolRoutes } from "./routes/school";
import { shiftsRoutes } from "./routes/shifts";
import { teachersRoutes } from "./routes/teachers";
import { classesRoutes } from "./routes/classes";
import { subjectsRoutes } from "./routes/subjects";
import { scheduleRoutes } from "./routes/schedule";
import { generateRoutes } from "./routes/generate";

const app = new Hono()
  .basePath("api")
  .use(cors({ origin: "*" }))
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .route("/school", schoolRoutes)
  .route("/shifts", shiftsRoutes)
  .route("/teachers", teachersRoutes)
  .route("/classes", classesRoutes)
  .route("/subjects", subjectsRoutes)
  .route("/schedule", scheduleRoutes)
  .route("/generate", generateRoutes);

export type AppType = typeof app;
export default app;
