import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(
    { error: "RAW_CRUD_UPLOAD_DISABLED", commandEndpoint: "/api/sync/commands" },
    { status: 409 },
  );
}
