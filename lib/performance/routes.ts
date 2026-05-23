const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_TOKEN_RE = /^[0-9a-z_-]{18,}$/i;

export function normalizePerformanceRoute(input: string | URL | null | undefined) {
  if (!input) return null;

  let pathname = "";
  try {
    pathname = input instanceof URL ? input.pathname : new URL(input, "http://moniq.local").pathname;
  } catch {
    pathname = String(input).split("?")[0] ?? "";
  }

  const normalized = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const decoded = safeDecode(segment);
      if (UUID_RE.test(decoded)) return "[id]";
      if (/^\d+$/.test(decoded)) return "[id]";
      if (LONG_TOKEN_RE.test(decoded) && /[0-9]/.test(decoded)) return "[id]";
      return decoded.slice(0, 80);
    })
    .join("/");

  return `/${normalized}`.slice(0, 240);
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
