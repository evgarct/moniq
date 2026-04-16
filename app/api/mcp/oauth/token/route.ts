import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { verifyPkce, generateRawToken, sha256Hex } from "./pkce";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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

  const db = createAnonClient();

  // Atomically redeem the code via RPC — returns the row only if code is valid,
  // unused, and not expired; marks it used in the same statement (no race condition).
  const { data: rows, error: redeemError } = await db.rpc("mcp_oauth_redeem_code", {
    p_code: code,
  });

  if (redeemError || !rows || rows.length === 0) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Code is invalid, expired, or already used" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const codeRow = rows[0] as {
    user_id: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
  };

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

  // Generate bearer token and store via RPC
  const rawToken = generateRawToken();
  const keyHash = await sha256Hex(rawToken);
  const keyPrefix = rawToken.slice(0, 10);

  const { error: storeError } = await db.rpc("mcp_oauth_store_token", {
    p_user_id: codeRow.user_id,
    p_name: "Claude OAuth",
    p_key_hash: keyHash,
    p_key_prefix: keyPrefix,
  });

  if (storeError) {
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to create access token" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { access_token: rawToken, token_type: "bearer", scope: "mcp" },
    { headers: CORS_HEADERS },
  );
}
