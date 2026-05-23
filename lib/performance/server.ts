import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { normalizePerformanceRoute } from "@/lib/performance/routes";
import type { PerformanceEventInput } from "@/lib/performance/schema";
import { createServiceClient } from "@/lib/supabase/service";

const SESSION_COOKIE = "moniq_perf_sid";
const SAMPLE_RATES: Partial<Record<PerformanceEventInput["event_type"], number>> = {
  web_vital: 1,
  navigation: 1,
  fetch: 1,
  client_error: 1,
  api: 1,
  repository: 1,
  db_phase: 1,
  mutation: 1,
};

export function hashPerformanceUserId(userId: string) {
  const salt = process.env.PERFORMANCE_ANALYTICS_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "moniq-local";
  return createHash("sha256").update(`${salt}:${userId}`).digest("hex");
}

export async function getPerformanceSessionId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const next = randomUUID();
  try {
    cookieStore.set(SESSION_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    // Server Components cannot always write cookies; route handlers can.
  }

  return next;
}

export async function recordPerformanceEvent(input: PerformanceEventInput) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

    const sampleRate = SAMPLE_RATES[input.event_type] ?? 1;
    if (sampleRate < 1 && Math.random() > sampleRate) return;

    const user_id_hash = input.userId ? hashPerformanceUserId(input.userId) : null;
    const session_id = user_id_hash ? input.sessionId ?? null : input.sessionId ?? (await getPerformanceSessionId());

    const supabase = createServiceClient();
    await supabase.from("performance_events").insert({
      event_type: input.event_type,
      name: input.name.slice(0, 160),
      route: normalizePerformanceRoute(input.route ?? input.name),
      method: input.method?.slice(0, 12).toUpperCase() ?? null,
      status: input.status ?? null,
      duration_ms: input.duration_ms ?? null,
      phase: input.phase?.slice(0, 80) ?? null,
      user_id_hash,
      session_id,
      metadata: sanitizeMetadata(input.metadata),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Unable to record performance event", error);
    }
  }
}

export async function measurePerformance<T>(
  input: Omit<PerformanceEventInput, "duration_ms" | "status">,
  work: () => Promise<T>,
  options?: { status?: (result: T) => number | null },
) {
  const startedAt = performance.now();
  try {
    const result = await work();
    await recordPerformanceEvent({
      ...input,
      status: options?.status?.(result) ?? null,
      duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
    });
    return result;
  } catch (error) {
    await recordPerformanceEvent({
      ...input,
      status: 500,
      duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
      metadata: {
        ...input.metadata,
        error_class: error instanceof Error ? error.name : "unknown",
      },
    });
    throw error;
  }
}

function sanitizeMetadata(metadata: PerformanceEventInput["metadata"]) {
  if (!metadata) return {};

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 24)
      .map(([key, value]) => [key.slice(0, 64), sanitizeMetadataValue(value)]),
  );
}

function sanitizeMetadataValue(value: string | number | boolean | null) {
  if (typeof value === "string") return value.slice(0, 160);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean" || value === null) return value;
  return null;
}
