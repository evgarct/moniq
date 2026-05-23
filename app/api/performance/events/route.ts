import { NextResponse } from "next/server";

import { clientPerformanceEventBatchSchema } from "@/lib/performance/schema";
import { getPerformanceSessionId, recordPerformanceEvent } from "@/lib/performance/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = clientPerformanceEventBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid performance event payload." }, { status: 400 });
  }

  const sessionId = await getPerformanceSessionId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await Promise.all(
    parsed.data.events.map((event) =>
      recordPerformanceEvent({
        ...event,
        userId: user?.id ?? null,
        sessionId,
      }),
    ),
  );

  return new NextResponse(null, { status: 204 });
}
