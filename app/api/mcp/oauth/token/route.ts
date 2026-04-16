import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyPkce, generateRawToken, sha256Hex } from "./pkce";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  let grantType: string | null = null;
  let code: string | null = null;
  let codeVerifier: string | null = null;
  let clientId: string | null = null;
  let redirectUri: string | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    grantType = formData.get("grant_type") as string | null;
    code = formData.get("code") as string | null;
    codeVerifier = formData.get("code_verifier") as string | null;
    clientId = formData.get("client_id") as string | null;
    redirectUri = formData.get("redirect_uri") as string | null;
  } else {
    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Invalid JSON body" },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    grantType = body.grant_type ?? null;
    code = body.code ?? null;
    codeVerifier = body.code_verifier ?? null;
    clientId = body.client_id ?? null;
    redirectUri = body.redirect_uri ?? null;
  }

  if (grantType !== "authorization_code") {
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (!code || !codeVerifier || !clientId || !redirectUri) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required parameters" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const service = createServiceClient();

  // Look up the authorization code
  const { data: codeRow } = await service
    .from("mcp_oauth_codes")
    .select("id, user_id, client_id, redirect_uri, code_challenge, used, expires_at")
    .eq("code", code)
    .single();

  if (!codeRow) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Unknown code" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (codeRow.used) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Code already used" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Code expired" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (codeRow.client_id !== clientId) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "client_id mismatch" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (codeRow.redirect_uri !== redirectUri) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "redirect_uri mismatch" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Verify PKCE
  const pkceValid = await verifyPkce(codeVerifier, codeRow.code_challenge);
  if (!pkceValid) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Atomically mark code as used — conditional on used=false prevents races
  // where two concurrent requests both read used=false and both mint tokens.
  const { data: consumed, error: consumeError } = await service
    .from("mcp_oauth_codes")
    .update({ used: true })
    .eq("id", codeRow.id)
    .eq("used", false) // only succeeds if not yet redeemed
    .select("id");

  if (consumeError || !consumed || consumed.length === 0) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Code already used" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Generate token
  const rawToken = generateRawToken();
  const keyHash = await sha256Hex(rawToken);
  const keyPrefix = rawToken.slice(0, 10);

  // Store in mcp_api_keys
  const { error: insertError } = await service.from("mcp_api_keys").insert({
    user_id: codeRow.user_id,
    name: "Claude OAuth",
    key_hash: keyHash,
    key_prefix: keyPrefix,
  });

  if (insertError) {
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to create access token" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      access_token: rawToken,
      token_type: "bearer",
      scope: "mcp",
    },
    { headers: CORS_HEADERS },
  );
}
