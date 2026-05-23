import "server-only";

import type { NextResponse } from "next/server";

import { getPerformanceSessionId, measurePerformance } from "@/lib/performance/server";

export async function withApiPerformance<T extends NextResponse>(
  request: Request,
  name: string,
  handler: () => Promise<T>,
  metadata?: Record<string, string | number | boolean | null>,
) {
  const sessionId = await getPerformanceSessionId();
  return measurePerformance(
    {
      event_type: "api",
      name,
      route: request.url,
      method: request.method,
      sessionId,
      metadata,
    },
    handler,
    {
      status: (response) => response.status,
    },
  );
}

export async function withMutationPerformance<T>(
  request: Request,
  name: string,
  work: () => Promise<T>,
  metadata?: Record<string, string | number | boolean | null>,
) {
  const sessionId = await getPerformanceSessionId();
  return measurePerformance(
    {
      event_type: "mutation",
      name,
      route: request.url,
      method: request.method,
      sessionId,
      metadata,
    },
    work,
  );
}
