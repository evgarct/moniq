import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let body: { redirect_uris?: string[]; client_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { redirect_uris, client_name } = body;

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uris is required" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const service = createServiceClient();

  const { data, error } = await service
    .from("mcp_oauth_clients")
    .insert({
      redirect_uris,
      client_name: client_name ?? null,
    })
    .select("client_id, client_name, redirect_uris, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to register client" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      client_id: data.client_id,
      client_name: data.client_name,
      redirect_uris: data.redirect_uris,
      client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
    },
    { status: 201, headers: CORS_HEADERS },
  );
}
