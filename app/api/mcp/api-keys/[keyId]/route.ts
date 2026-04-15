import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/mcp/api-keys/[keyId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyId } = await params;

  const { error } = await supabase
    .from("mcp_api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
