import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { SyncBootstrap } from "@/types/sync";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rawMode = process.env.NEXT_PUBLIC_LOCAL_FIRST_MODE;
  const mode: SyncBootstrap["mode"] = rawMode === "on" || rawMode === "pilot" ? rawMode : "off";
  const pilotIds = new Set((process.env.LOCAL_FIRST_PILOT_USER_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const enabled = mode === "on" || (mode === "pilot" && pilotIds.has(user.id));
  const payload: SyncBootstrap = {
    enabled,
    mode,
    powersyncUrl: enabled ? process.env.NEXT_PUBLIC_POWERSYNC_URL?.trim() || null : null,
    serverTime: new Date().toISOString(),
    userId: user.id,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
