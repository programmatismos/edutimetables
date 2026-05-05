# Web

## Overview

The web frontend lives in `packages/web/src/web/` and is served by Vite in development. The API runs in the same process via a Vite plugin. Uses React, Wouter for routing, `hono/client` for typed API calls, and `@tanstack/react-query` for queries and mutations.

This is the **single UI codebase** — it also runs inside the desktop Electron shell.

### Dev Server

Start web from root: `bun run dev`. For a custom port: `bun run dev --port <port>`.

### Icons

Use `lucide-react` for icons. For animated micro-interactions, use `lucide-animated`. Prefer icons over emojis.

## Key Rules

- **Always show a loading state for every API call** — check `isLoading` and render a loader/skeleton before rendering data. For action buttons (submit, save, delete, etc.), show a loading indicator and disable the button while the mutation is pending.
- **Use optimistic updates for instant-feel interactions** — for likes, comments, bookmarks, toggles, etc. See [Optimistic updates](#optimistic-updates) section for the pattern.
- **Wouter `<Link>` renders an `<a>` tag** — never put an `<a>` inside a `<Link>`. Use `<Link to="/path"><span>...</span></Link>` or `<Link to="/path" className="...">text</Link>` instead.

## Project Structure

```
packages/web/
  public/                        Static assets (favicon, images, fonts)
  index.html                     Frontend HTML entry
  vite.config.ts                 Vite config (React, Tailwind, Hono dev plugin)
  vite/plugins/
    hono-dev-plugin.ts           Serves Hono API in dev via Vite middleware
    runable-analytics-plugin.ts  Injects analytics script

  src/
    api/                         Backend source
      index.ts                   Hono routes + AppType export
      database/                  Database (schema, client)
    web/                         Frontend source
      main.tsx                   App entry (Router)
      app.tsx                    Root app component (Switch + routes)
      styles.css                 Global styles (Tailwind)
      pages/                     Page components
        index.tsx                / page
      components/                Shared components
        provider.tsx             App providers
        ui/                      UI primitives
      hooks/                     Custom hooks
      lib/                       Utilities
      types/                     Type definitions
```

## Adding Pages

1. Create a page component in `src/web/pages/`:

```tsx
// src/web/pages/about.tsx
export default function AboutPage() {
  return <h1>About</h1>;
}
```

2. Add a route in `src/web/app.tsx`:

```tsx
import { Route, Switch } from "wouter";
import AboutPage from "./pages/about";

function App() {
  return (
    <Switch>
      <Route path="/" component={Index} />
      <Route path="/about" component={AboutPage} />
    </Switch>
  );
}
```

### Dynamic routes

```tsx
// src/web/pages/user.tsx
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const user = useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      const res = await api.users[":id"].$get({ param: { id } });
      return res.json();
    },
  });

  if (user.isLoading) return <div>Loading...</div>;

  return <h1>{user.data?.name}</h1>;
}

// In app.tsx:
<Route path="/users/:id" component={UserPage} />
```

### Nested layouts

```tsx
// src/web/components/layout.tsx
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      {children}
    </div>
  );
}

// In app.tsx, wrap routes:
<Layout>
  <Switch>
    <Route path="/" component={Index} />
    <Route path="/about" component={AboutPage} />
  </Switch>
</Layout>
```

## Typed API Client

Uses `hono/client` for typed calls and `@tanstack/react-query` for state management:

```ts
// src/web/lib/api.ts
import { hc } from "hono/client";
import type { AppType } from "../../api";

const client = hc<AppType>("/");
export const api = client.api;
```

### Queries

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const users = useQuery({
  queryKey: ["users"],
  queryFn: async () => (await api.users.$get()).json(),
});

// With parameters
const user = useQuery({
  queryKey: ["user", id],
  queryFn: async () => (await api.users[":id"].$get({ param: { id } })).json(),
});
```

### Mutations

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
const createUser = useMutation({
  mutationFn: async (data: { name: string; email: string }) => {
    const res = await api.users.$post({ json: data });
    return res.json();
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
});

createUser.mutate({ name: "Alice", email: "alice@example.com" });
```

### Optimistic updates

For any instant-feel mutation, follow this pattern (e.g. likes, deletes, toggles):

```tsx
const toggleLike = useMutation({
  mutationFn: async (postId: string) => {
    await api.posts[":id"].like.$post({ param: { id: postId } });
  },
  onMutate: async (postId) => {
    await queryClient.cancelQueries({ queryKey: ["posts"] });
    const prev = queryClient.getQueryData(["posts"]);
    queryClient.setQueryData(["posts"], (old: any) =>
      old?.map((p: any) => p.id === postId ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p)
    );
    return { prev };
  },
  onError: (_err, _id, ctx) => queryClient.setQueryData(["posts"], ctx?.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
});
```
