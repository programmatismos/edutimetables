# Mobile

## Overview

`packages/mobile` is an Expo + React Native app with expo-router (file-based routing), `hono/client` for typed API calls, and `@tanstack/react-query` for queries and mutations.

When creating an app, update `app.json` → `expo.name` and `expo.slug` to the app's name (e.g. `"name": "My App"`, `"slug": "my-app"`).

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

Use optimistic updates for mutations where the result is predictable (toggles, likes, deletes, status changes). Update the UI instantly, revert on error.

```tsx
const queryClient = useQueryClient();
const deleteTodo = useMutation({
  mutationFn: async (id: string) => {
    await api.todos[":id"].$delete({ param: { id } });
  },
  onMutate: async (id) => {
    const prev = queryClient.getQueryData(["todos"]);
    queryClient.setQueryData(["todos"], (old: any) =>
      old?.filter((t: any) => t.id !== id)
    );
    return { prev };
  },
  onError: (_err, _id, context) => {
    queryClient.setQueryData(["todos"], context?.prev);
  },
});
```

## Running

```bash
cd packages/mobile
bun run dev            # Expo dev server
bun run ios            # iOS simulator
bun run android        # Android emulator
```
