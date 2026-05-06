---
name: app
description: Use for any app creation task — planning, implementing pages, screens, API routes, database schema, and delivering. Supports web, mobile, and desktop apps from a single codebase. Includes authentication, payments, AI agent, and email as optional modules.
---

# App

## Stack

Monorepo: Bun workspaces + Turborepo.

- **Web:** Vite 7 dev server — serves both the React frontend (`/*`) and the Hono API (`/api/*` via `vite/plugins/hono-dev-plugin.ts`) from a single port in `packages/web`
- **API:** Hono with `.basePath('api')`, Drizzle ORM + Turso (SQLite) — source in `packages/web/src/api/`
- **Web Frontend:** React 19 + Wouter + Tailwind CSS 4, bundled by Vite — source in `packages/web/src/web/`
- **Mobile:** Expo + React Native + expo-router
- **Desktop:** Electron shell + Vite (loads the web app from the server, exposes native APIs via IPC)

## App Config

The web service serves both the API at `/api/*` and the web frontend at `/*` from a single port. Ports are configured automatically — do not hardcode them.

Typed end-to-end: `packages/web` exports `AppType` from `src/api/index.ts`, all clients use `hono/client` for typed API calls and `@tanstack/react-query` for queries and mutations.

## Preflight

1. Ask questions: purpose, platforms(mobile, web, desktop) need templates (MUST confirm — assume YES if unclear), industry, style, sections, features.
2. If templates wanted, call `show_templates` with relevant `query` and `type: website`. This must be its own standalone call.
3. Form a plan. State assumptions as decisions — the user corrects what's wrong. Include: what's being built, which packages are touched, API routes, database tables, screens/pages, files to create/modify. Follow brand colors/fonts/logo/vibe if available. Template is for visual style and layout only.

Do not start implementation until the user approves or adjusts the plan.

## Design Guidelines

Document design direction in `design.md` inside the website project directory before writing UI code. Reference it throughout for consistency.

- **Typography**: always set a font family. If no font is specified, default to Poppins for web. Pair display + body. Hierarchy through size/weight. Generous line height.
- **Color**: dominant color with sharp accents. CSS variables + Tailwind. Accents for emphasis, not decoration.
- **Layout**: asymmetric, overlapping, grid-breaking. Generous negative space or controlled density — intentionally.
- **Backgrounds**: gradient meshes, noise textures, geometric patterns, layered transparencies. Match the aesthetic.
- **Motion**: one well-orchestrated page load with staggered reveals > scattered micro-interactions. CSS-only for HTML, Motion library for React.
- **Anti-patterns** (will look bad): purple gradients on white, predictable card grids with rounded corners, cookie-cutter layouts, overused fonts (Inter, Space Grotesk, Roboto).

## Workflow

1. Run preflight.
2. Call `app_init` with absolute `app_path`, `name`, `description`. **Do NOT create the directory beforehand** — `app_init` creates it and fails if it already exists.
3. Move or copy any provided assets (images, logos, fonts, etc.) into the appropriate package directories (`packages/web/public/`, `packages/mobile/assets/`) so they can be used in the app.
4. Write `design.md` in the project root with the design direction from preflight (fonts, colors, spacing, style). This file guides all UI code for consistency.
5. Build API routes, database schema, pages/screens, and ui components for the app.
5. Call `deliver` with required parameters for the apps.

### Rules

- Use `bun run dev`, `bun run dev:mobile`, `bun run dev:desktop` from root to start the development servers. For custom ports use `bun run dev --port <port>`.
- **All API routes must be chained** on the same `app` instance in `packages/web/src/api/index.ts`. Breaking the chain breaks type inference.
- **Always pass explicit status codes** — `c.json(data, 200)`, never `c.json(data)`. Without this, the typed RPC client resolves response types to `never`.
- **Routes should be defined without `/api` prefix.** `.basePath('api')` adds it. `.get("/health", ...)` → `/api/health`.
- **Typed client paths include `api/`** (e.g., `"api/health"`). `baseUrl` is just the origin — no `/api`.
- **Desktop loads the web app** — no separate renderer. Gate desktop UI with `useDesktop()` / `window.electronAPI`. Only create a separate renderer if explicitly asked.
- **Vite loads `.env` automatically** — no dotenv needed. Always use `.env`, never `.env.local`.
- **Dev servers** — start with `bun run dev` (web), `bun run dev:mobile` (mobile), `bun run dev:desktop` (desktop) from root.

### Database

```bash
cd packages/web
bun run db:push          # Push schema to database
bun run db:generate      # Generate migration files
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio
```

## References

Must Read a reference **only when implementing that feature**. Do not read all references upfront.

| Feature | Reference |
|---------|-----------|
| API routes & database | [references/api.md](references/api.md) |
| Web pages & components | [references/web.md](references/web.md) |
| Mobile screens | [references/mobile.md](references/mobile.md) |
| Desktop native features | [references/desktop.md](references/desktop.md) |
| User-Authentication/Organization | [references/authentication.md](references/authentication.md) |
| Payments, billing, subscriptions | [references/payments.md](references/payments.md) |
| AI agent, chatbot, LLM | [references/ai-agent.md](references/ai-agent.md) |
| Email | [references/email.md](references/email.md) |
| File upload (R2 storage) | [references/file-upload.md](references/file-upload.md) |

## Testing

Before delivering, run `bun run build` to verify the app compiles without errors. Fix any failures before delivering.
