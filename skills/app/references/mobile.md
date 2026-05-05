# Mobile

## Overview

`packages/mobile` is an Expo + React Native app with expo-router (file-based routing), `hono/client` for typed API calls, and `@tanstack/react-query` for queries and mutations.

When creating an app, update `app.json`:
- Set `expo.name` and `expo.slug` to the app's name (e.g. `"name": "My App"`, `"slug": "my-app"`).
- Generate `ios.bundleIdentifier` and `android.package` using the format `com.<appname>_<shortid>.runable` where `<shortid>` is a random 4-char alphanumeric string (e.g. `com.myapp_a3x9.runable`).
- Always update `app/index.tsx` to reflect the new app's UI.

### Dev Server

Start mobile from root: `bun run dev:mobile`. For a custom port: `bun run dev:mobile --port <port>`.

### Icons

Use `@expo/vector-icons` (bundled with Expo) for icons. For a premium look, use `phosphor-react-native` which offers duotone and multiple weight variants. Prefer icons over emojis.

## Project Structure

```
packages/mobile/
  app/
    _layout.tsx              Root layout (QueryClientProvider + SafeAreaProvider)
    index.tsx                / screen
    profile.tsx              /profile screen
    users/
      index.tsx              /users screen
      [id].tsx               /users/:id screen
  lib/
    api.ts                   Typed API client
  assets/                    App icons, splash screen
  app.json                   Expo config
  eas.json                   EAS build profiles with env vars
  env.d.ts                   Type declarations for process.env
  web/
    src/
      api/                   For all the api endpoints/database
```

## Key Rules

- Always wrap screen content in `SafeAreaView` from `react-native-safe-area-context` to avoid notch/status bar/home indicator overlap.
- **Use optimistic updates for instant-feel interactions** — for likes, comments, bookmarks, toggles, etc. See [Optimistic updates](#optimistic-updates) section for the pattern.

## Adding Screens

Create files in `app/`. Expo Router uses file-based routing.

```tsx
// app/profile.tsx
import { View, Text } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Profile</Text>
    </View>
  );
}
```

### Dynamic routes

```tsx
// app/users/[id].tsx
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery({
    queryKey: ["user", id],
    queryFn: async () => (await api.users[":id"].$get({ param: { id } })).json(),
  });

  if (user.isLoading) return <ActivityIndicator />;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24 }}>{user.data?.name}</Text>
    </View>
  );
}
```

### Layouts and navigation

```tsx
// app/_layout.tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

Tab navigation:

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
```

## Typed API Client

Uses `hono/client` for typed calls and `@tanstack/react-query` for state management:

```ts
// lib/api.ts
import { hc } from "hono/client";
import Constants from "expo-constants";
import type { AppType } from "@template/web";

const baseUrl =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL;

const client = hc<AppType>(baseUrl!);
export const api = client.api;
```

Usage:

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

// Queries
const users = useQuery({
  queryKey: ["users"],
  queryFn: async () => (await api.users.$get()).json(),
});

// Mutations
const queryClient = useQueryClient();
const createUser = useMutation({
  mutationFn: async (data: { name: string; email: string }) =>
    (await api.users.$post({ json: data })).json(),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
});
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

## Running

```bash
cd packages/mobile
bun run dev            # Expo dev server
bun run ios            # iOS simulator
bun run android        # Android emulator
```
