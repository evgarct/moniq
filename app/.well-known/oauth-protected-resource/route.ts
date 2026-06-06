import { NextResponse } from "next/server";

import { getAppUrl, getMcpUrl } from "@/lib/app-url";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  const base = getAppUrl();

  return NextResponse.json(
    {
      resource: getMcpUrl(),
      authorization_servers: [base],
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
