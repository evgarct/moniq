import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const redirectUris = body.redirect_uris;
  const clientName = typeof body.client_name === "string" ? body.client_name : null;

  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uris must be a non-empty array" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  for (const uri of redirectUris) {
    if (typeof uri !== "string") {
      return NextResponse.json(
        { error: "invalid_request", error_description: "redirect_uris must contain strings" },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    try {
      new URL(uri);
    } catch {
      return NextResponse.json(
        { error: "invalid_request", error_description: `Invalid redirect_uri: ${uri}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }
  }

  // Generate a client_id and upsert via security-definer RPC (no service role needed)
  const clientId = crypto.randomUUID();
  const db = createAnonClient();

  const { error } = await db.rpc("mcp_oauth_upsert_client", {
    p_client_id: clientId,
    p_client_name: clientName,
    p_redirect_uris: redirectUris as string[],
  });

  if (error) {
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to register client" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: CORS_HEADERS },
  );
}
