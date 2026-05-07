# API & Database

## Overview

`packages/web` serves both the Hono API (under `/api`) and the web frontend via Vite. In development, a custom Vite plugin (`vite/plugins/hono-dev-plugin.ts`) intercepts `/api/*` requests and forwards them to the Hono app with hot-reloading via `ssrLoadModule`.

- `src/api/index.ts` — Hono app definition with `.basePath('api')`, CORS, routes, and `AppType` export (consumed by mobile as a package)
- `vite/plugins/hono-dev-plugin.ts` — Vite middleware that serves the Hono API in dev

**Routes in `src/api/index.ts` are defined without the `/api` prefix.** The prefix is applied by Hono's `.basePath('api')`. A route `.get("/health", ...)` is accessible at `/api/health`.

## Adding API Routes

All routes **must** be chained on the same `app` instance in `src/api/index.ts`. Breaking the chain breaks type inference for consumers.

```ts
// src/api/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "./database";
import * as schema from "./database/schema";

const app = new Hono()
  .basePath("api")
  .use(cors({ origin: "*" }))
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .get("/users", async (c) => {
    const users = await db.select().from(schema.users);
    return c.json({ users }, 200);
  })
  .post("/users", async (c) => {
    const body = await c.req.json();
    const user = await db.insert(schema.users).values(body).returning();
    return c.json({ user }, 201);
  });

export type AppType = typeof app;
export default app;
```

**Critical:** Always pass explicit status codes — `c.json(data, 200)`, never `c.json(data)`. Without this, the typed RPC client resolves response types to `never`.

## Organizing Routes

For larger APIs, use Hono's `.route()` to compose sub-routers. Each sub-router must also be chained:

```ts
// src/api/routes/users.ts
import { Hono } from "hono";

export const users = new Hono()
  .get("/", async (c) => { /* list */ })
  .post("/", async (c) => { /* create */ })
  .get("/:id", async (c) => { /* get by id */ });

// src/api/index.ts
import { users } from "./routes/users";

const app = new Hono()
  .basePath("api")
  .use(cors({ origin: "*" }))
  .route("/users", users)
  .get("/health", (c) => c.json({ status: "ok" }, 200));
```

## Vite Dev Server

The Hono API is served in dev via a Vite plugin (`vite/plugins/hono-dev-plugin.ts`). It intercepts `/api/*` requests and forwards them to the Hono app using Vite's `ssrLoadModule`, which provides hot-reloading. No separate server process needed.

```ts
// vite.config.ts
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";

export default defineConfig({
  plugins: [honoDevPlugin(), react(), tailwind()],
  // ...
});
```

## Database Schema

Define tables in `packages/web/src/api/database/schema.ts`:

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

## Database Commands

```bash
cd packages/web
bun run db:push        # Push schema to database
bun run db:generate    # Generate migration files
bun run db:migrate     # Run migrations
bun run db:studio      # Open Drizzle Studio
```

## Using the Database

```ts
import { db } from "./database";
import * as schema from "./database/schema";
import { eq } from "drizzle-orm";

// Select
const users = await db.select().from(schema.users);
const user = await db.select().from(schema.users).where(eq(schema.users.id, 1));

// Insert
const [newUser] = await db.insert(schema.users).values({ name: "Alice", email: "alice@example.com" }).returning();

// Update
await db.update(schema.users).set({ name: "Bob" }).where(eq(schema.users.id, 1));

// Delete
await db.delete(schema.users).where(eq(schema.users.id, 1));
```

## Middleware

```ts
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

const logger = createMiddleware(async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});

const app = new Hono()
  .basePath("api")
  .use("*", logger)
  .get("/health", (c) => c.json({ status: "ok" }, 200));
```

## Auth & Protected Routes

For user-specific data, roles, or access control, use Better Auth (see [authentication.md](authentication.md)). Apply `authMiddleware` to populate `c.get("user")`, then `requireAuth` on protected routes:

```ts
import { authMiddleware, requireAuth } from "./middleware/auth";

const app = new Hono()
  .basePath("api")
  .use("*", authMiddleware)
  .get("/profile", requireAuth, async (c) => {
    const user = c.get("user");
    return c.json({ user }, 200);
  });
```

All user-scoped queries should filter by `user.id` from the session.

## Environment Variables

API-only (unprefixed): `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_API_KEY`, `AUTUMN_SECRET_KEY`.

Vite loads `.env` automatically.
