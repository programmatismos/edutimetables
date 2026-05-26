import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toPositiveInteger(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseSupervisorIds(value: unknown): number[] {
  const values = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || value.length === 0) return [];

    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return values
    .map(toPositiveInteger)
    .filter((id): id is number => id !== null);
}
