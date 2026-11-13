/**
 * Native clients (the Android app) cannot hold the cookie session the web app uses, so they send
 * their Supabase access token as `Authorization: Bearer <jwt>` together with `X-Moniq-Client`.
 *
 * The marker header is required on purpose: MCP routes also receive `Authorization: Bearer`
 * values (Moniq API keys, OAuth tokens) that are not Supabase sessions and must keep resolving
 * the tenant through their own key-hash RPCs.
 */
export const MOBILE_CLIENT_HEADER = "x-moniq-client";

const MOBILE_CLIENTS = new Set(["android"]);
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type HeaderReader = { get(name: string): string | null };

/** Returns the Supabase access token of a native client request, or null for every other request. */
export function readMobileAccessToken(headers: HeaderReader): string | null {
  const client = headers.get(MOBILE_CLIENT_HEADER)?.trim().toLowerCase();
  if (!client || !MOBILE_CLIENTS.has(client)) return null;

  const authorization = headers.get("authorization")?.trim();
  if (!authorization) return null;

  const [scheme, token, ...rest] = authorization.split(/\s+/);
  if (rest.length > 0 || scheme?.toLowerCase() !== "bearer" || !token) return null;

  return JWT_SHAPE.test(token) ? token : null;
}
