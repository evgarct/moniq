import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { readMobileAccessToken } from "@/lib/supabase/bearer";

/**
 * A request-scoped client for a native app session. PostgREST and RPC calls carry the caller's
 * access token, so RLS applies exactly as it does for the cookie session; `getClaims`/`getUser`
 * default to that token because there is no stored session to read it from.
 */
function createBearerClient(accessToken: string) {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );

  const getClaims = client.auth.getClaims.bind(client.auth);
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getClaims = ((jwt, options) => getClaims(jwt ?? accessToken, options)) as typeof client.auth.getClaims;
  client.auth.getUser = ((jwt) => getUser(jwt ?? accessToken)) as typeof client.auth.getUser;

  return client;
}

export async function createClient() {
  const mobileAccessToken = readMobileAccessToken(await headers());
  if (mobileAccessToken) {
    return createBearerClient(mobileAccessToken);
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes are ignored from Server Components. Proxy and Server Actions handle refreshes.
          }
        },
      },
    },
  );
}
