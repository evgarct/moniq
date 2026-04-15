import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role Supabase client — bypasses RLS.
 * Only use server-side for operations that legitimately need to bypass RLS
 * (e.g. MCP API key lookup by hash where no user session exists).
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
