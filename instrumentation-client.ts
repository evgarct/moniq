import { reportClientPerformanceEvent } from "@/lib/performance/client";

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  reportClientPerformanceEvent({
    event_type: "navigation",
    name: "router_transition_start",
    route: url,
    metadata: {
      navigation_type: navigationType,
    },
  });
}
