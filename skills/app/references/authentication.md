# Authentication

We use [Better Auth](https://www.better-auth.com) for authentication.

**Pinned version:** `better-auth@1.4.22`. Do not upgrade to 1.5.x — it breaks `autumn-js`.

Reference docs: [llms.txt](https://www.better-auth.com/llms.txt)

<preflight>
Before wiring, state your assumptions about which auth methods are needed (email/password, OAuth, magic link), which routes/screens should be protected, where users land after sign-in, and whether sign-in/sign-up are separate pages or a single page with tabs. The user will correct what's wrong.
</preflight>

<design_thinking>
Auth pages are the first impression for returning users — match the app's visual language, don't ship barebones forms. Error states matter as much as the happy path. Loading and redirect transitions should feel instant.
</design_thinking>

## 1. Install

```bash
cd packages/web && bun add better-auth@1.4.22
cd packages/mobile && bun add better-auth@1.4.22
```

## 2. Auth Config

Create `packages/web/src/api/auth.ts`.

`basePath` must be `/api/auth`. Auth routes are served by the Hono app under the `/api` basePath, so Better Auth receives requests at `/api/auth/...`.

**Always set `trustedOrigins: ["*"]`** — the app is accessed from multiple origins (web, mobile, desktop, preview URLs).

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./database";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: ["*"],
});
```

`baseURL` is set from `WEBSITE_URL` env var. Required for OAuth callbacks and production. Do **not** import JSON config files in this file — the Better Auth CLI uses jiti which cannot resolve them.

## 3. Generate Auth Schema

The CLI uses jiti (not bun env loading). Pass env vars inline. Run generate BEFORE adding `export * from "./auth-schema"` to `schema.ts` — the CLI fails if the target file doesn't exist yet.

```bash
cd packages/web
DATABASE_URL=$DATABASE_URL BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET bun x @better-auth/cli@latest generate --config=./src/api/auth.ts --output=./src/api/database/auth-schema.ts -y
```

After the schema file is generated, re-export from `src/api/database/schema.ts`:

```ts
export * from "./auth-schema";
```

Then push: `bun run db:push`

## 4. Mount Auth in Hono

Auth must be mounted **before** `.basePath()` so Better Auth receives the full `/api/auth/*` path. Use `.on()` with single `*` wildcard (Hono v4 uses `*` not `**`):

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";

const app = new Hono()
  .use(cors({ origin: "*" }))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath("api")
  .get("/health", (c) => c.json({ status: "ok" }, 200));

export type AppType = typeof app;
export default app;
```

## 5. Auth Middleware

Create `packages/web/src/api/middleware/auth.ts`:

```ts
import { createMiddleware } from "hono/factory";
import { auth } from "../auth";

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  return next();
});

export const requireAuth = createMiddleware(async (c, next) => {
  if (!c.get("user")) return c.json({ message: "Unauthorized" }, 401);
  return next();
});
```

## 6. Web Auth Client

Create `packages/web/src/web/lib/auth.ts`:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
});
```

Usage:

```tsx
await authClient.signUp.email({ name, email, password });
await authClient.signIn.email({ email, password });
await authClient.signOut();
const { data: session, isPending } = authClient.useSession();
```

## 7. Mobile Auth Client

Create `packages/mobile/lib/auth.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";

const baseURL =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL;

export const authClient = createAuthClient({
  baseURL,
  basePath: "/api/auth",
});
```

## 8. Protected Routes

### Web (Wouter)

```tsx
// src/web/components/protected-route.tsx
import { Redirect } from "wouter";
import { authClient } from "../lib/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <Redirect to="/sign-in" />;

  return <>{children}</>;
}

// In app.tsx:
<Route path="/dashboard">
  <ProtectedRoute>
    <DashboardPage />
  </ProtectedRoute>
</Route>
```

### Mobile (Expo Router)

```tsx
export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) router.replace("/sign-in");
    if (session && inAuthGroup) router.replace("/");
  }, [session, isPending]);

  return <Slot />;
}
```
