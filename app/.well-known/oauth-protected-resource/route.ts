import { NextResponse } from "next/server";

import { getAppUrl, getMcpUrl } from "@/lib/app-url";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const base = getAppUrl(requestOrigin);

  return NextResponse.json(
    {
      resource: getMcpUrl(requestOrigin),
      authorization_servers: [base],
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
