import { NextResponse } from "next/server";
import { localizedOAuthErrorResponse } from "@/app/api/_lib/error-response";
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
      return localizedOAuthErrorResponse(request, "invalid_request", "common.errors.oauth.invalidJsonBody", 400, { headers: CORS_HEADERS });
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
    return localizedOAuthErrorResponse(request, "invalid_request", "common.errors.oauth.missingRequiredParameters", 400, { headers: CORS_HEADERS });
  }

  const db = createAnonClient();

  // Atomically redeem the code via RPC — returns the row only if code is valid,
  // unused, and not expired; marks it used in the same statement (no race condition).
  const { data: rows, error: redeemError } = await db.rpc("mcp_oauth_redeem_code", {
    p_code: code,
  });

  if (redeemError || !rows || rows.length === 0) {
    return localizedOAuthErrorResponse(request, "invalid_grant", "common.errors.oauth.invalidCode", 400, { headers: CORS_HEADERS });
  }

  const codeRow = rows[0] as {
    user_id: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
  };

  if (codeRow.client_id !== clientId) {
    return localizedOAuthErrorResponse(request, "invalid_grant", "common.errors.oauth.clientIdMismatch", 400, { headers: CORS_HEADERS });
  }

  if (codeRow.redirect_uri !== redirectUri) {
    return localizedOAuthErrorResponse(request, "invalid_grant", "common.errors.oauth.redirectUriMismatch", 400, { headers: CORS_HEADERS });
  }

  // Verify PKCE
  const pkceValid = await verifyPkce(codeVerifier, codeRow.code_challenge);
  if (!pkceValid) {
    return localizedOAuthErrorResponse(request, "invalid_grant", "common.errors.oauth.pkceFailed", 400, { headers: CORS_HEADERS });
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
    return localizedOAuthErrorResponse(request, "server_error", "common.errors.oauth.createAccessTokenFailed", 500, { headers: CORS_HEADERS });
  }

  return NextResponse.json(
    { access_token: rawToken, token_type: "bearer", scope: "mcp" },
    { headers: CORS_HEADERS },
  );
}
