import { hc } from "hono/client";
import type { AppType } from "../../api";

const client = hc<AppType>("/");
export const api = client.api;

/** Fetch a Hono client response and throw on error (non-2xx or error field in JSON) */
export async function safeJson(responsePromise: Promise<Response>): Promise<any> {
  let res: Response;
  try {
    res = await responsePromise;
  } catch (err: any) {
    throw new Error(`Δικτυακό σφάλμα: ${err?.message || err}`);
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Σφάλμα διακομιστή (${res.status}): μη αναγνώσιμη απάντηση`);
  }
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Σφάλμα διακομιστή (${res.status})`);
  }
  return data;
}
