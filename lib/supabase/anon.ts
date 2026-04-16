import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Anon Supabase client — uses the public anon key, no user session.
 * Use this for server-side operations that run without a cookie-based session
 * (e.g. MCP API routes, OAuth endpoints).
 *
 * Access to data is controlled via SECURITY DEFINER functions (RPC) rather
 * than direct table access, so the anon key is safe to use here.
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
