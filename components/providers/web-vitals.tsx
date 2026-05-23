"use client";

import { useReportWebVitals } from "next/web-vitals";

import { reportClientPerformanceEvent } from "@/lib/performance/client";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    reportClientPerformanceEvent({
      event_type: "web_vital",
      name: metric.name,
      route: typeof window === "undefined" ? undefined : window.location.pathname,
      duration_ms: metric.value,
      metadata: {
        id: metric.id,
        rating: "rating" in metric ? metric.rating : null,
        navigation_type: "navigationType" in metric ? metric.navigationType : null,
      },
    });
  });

  return null;
}
