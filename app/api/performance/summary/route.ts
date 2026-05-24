import { NextResponse } from "next/server";

import { localizedErrorResponse } from "@/app/api/_lib/error-response";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

type SummaryRow = {
  event_type: string;
  name: string;
  route: string | null;
  phase: string | null;
  status: number | null;
  duration_ms: number | null;
};

export async function GET(request: Request) {
  if (process.env.PERFORMANCE_ANALYTICS_SUMMARY_ENABLED === "false") {
    return localizedErrorResponse(request, "common.errors.performance.summaryDisabled", 404);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return localizedErrorResponse(request, "common.errors.unauthorized", 401);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return localizedErrorResponse(request, "common.errors.performance.storageNotConfigured", 503);
  }

  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window") === "7d" ? "7d" : "24h";
  const since = new Date(Date.now() - (windowParam === "7d" ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString();

  const service = createServiceClient();
  const { data, error } = await service
    .from("performance_events")
    .select("event_type, name, route, phase, status, duration_ms")
    .gte("created_at", since)
    .not("duration_ms", "is", null)
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (error) {
    return localizedErrorResponse(request, "common.errors.performance.summaryLoad", 500);
  }

  const rows = (data ?? []) as SummaryRow[];

  return NextResponse.json({
    window: windowParam,
    since,
    groups: summarize(rows, (row) => `${row.event_type}|${row.name}|${row.route ?? ""}`).slice(0, 50),
    finance_snapshot_phases: summarize(
      rows.filter((row) => row.name === "finance_snapshot"),
      (row) => `${row.event_type}|${row.name}|${row.phase ?? ""}`,
    ).slice(0, 30),
  });
}

function summarize(rows: SummaryRow[], keyFor: (row: SummaryRow) => string) {
  const groups = new Map<string, SummaryRow[]>();
  for (const row of rows) {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.values())
    .map((group) => {
      const first = group[0]!;
      const durations = group
        .map((row) => row.duration_ms)
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);
      const errors = group.filter((row) => (row.status ?? 0) >= 400).length;

      return {
        event_type: first.event_type,
        name: first.name,
        route: first.route,
        phase: first.phase,
        count: group.length,
        error_rate: group.length ? errors / group.length : 0,
        p50_ms: percentile(durations, 0.5),
        p95_ms: percentile(durations, 0.95),
        p99_ms: percentile(durations, 0.99),
      };
    })
    .sort((a, b) => b.p95_ms - a.p95_ms);
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
  return Math.round(values[index]! * 100) / 100;
}
