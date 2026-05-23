"use client";

import type { ClientPerformanceEventInput } from "@/lib/performance/schema";
import { normalizePerformanceRoute } from "@/lib/performance/routes";

const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE_SIZE = 25;

let queue: ClientPerformanceEventInput[] = [];
let flushTimer: number | null = null;

export function reportClientPerformanceEvent(event: ClientPerformanceEventInput) {
  queue.push({
    ...event,
    route: normalizePerformanceRoute(event.route ?? event.name) ?? undefined,
  });

  if (queue.length >= MAX_QUEUE_SIZE) {
    void flushPerformanceEvents();
    return;
  }

  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      void flushPerformanceEvents();
    }, FLUSH_INTERVAL_MS);
  }
}

export async function flushPerformanceEvents() {
  if (!queue.length) return;
  const events = queue.splice(0, MAX_QUEUE_SIZE);
  const body = JSON.stringify({ events });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/performance/events", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  try {
    await fetch("/api/performance/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body,
      keepalive: true,
    });
  } catch {
    queue = [...events, ...queue].slice(0, MAX_QUEUE_SIZE);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    void flushPerformanceEvents();
  });
}

export function reportFetchPerformance(input: {
  url: RequestInfo | URL;
  method: string;
  status?: number;
  durationMs: number;
  error?: string;
  responseBytes?: number | null;
}) {
  const route = normalizePerformanceRoute(input.url instanceof Request ? input.url.url : input.url);
  reportClientPerformanceEvent({
    event_type: "fetch",
    name: route ?? "fetch",
    route: route ?? undefined,
    method: input.method,
    status: input.status,
    duration_ms: Math.round(input.durationMs * 100) / 100,
    metadata: {
      error: input.error ?? null,
      response_bytes: input.responseBytes ?? null,
    },
  });
}
