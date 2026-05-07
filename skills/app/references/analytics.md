# Analytics

We use [Runable Analytics](https://onedollarstats.com) for privacy-friendly website analytics.

## Create Analytics Hook

Create `src/web/hooks/use-analytics.ts`:

```ts
export const useAnalytics = () => ({
  trackEvent: (name: string, props?: Record<string, unknown>) => {
    window.stonks?.event(name, props);
  },
  trackView: (path?: string, props?: Record<string, unknown>) => {
    window.stonks?.view(path, props);
  },
});
```

## Use In Components

```tsx
import { useAnalytics } from "../hooks/use-analytics";

function PricingPage() {
  const { trackEvent } = useAnalytics();

  const handlePlanSelect = (plan: string) => {
    trackEvent("plan_selected", { plan });
  };

  return <button onClick={() => handlePlanSelect("pro")}>Select Pro</button>;
}
```
