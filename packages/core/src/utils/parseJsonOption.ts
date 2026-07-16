export function parseJsonOption<T>(input: unknown, fallback: T, label: string): T {
  if (typeof input === "undefined") return fallback;
  if (typeof input !== "string") throw new Error(`${label} must be valid JSON.`);
  try {
    return JSON.parse(input) as T;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}
