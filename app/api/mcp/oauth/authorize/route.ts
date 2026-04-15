import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildConsentHtml({
  clientName,
  clientId,
  redirectUri,
  codeChallenge,
  state,
}: {
  clientName: string | null;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Claude — Moniq</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fafaf7; color: #1a1a18;
      min-height: 100vh; display: flex;
      align-items: center; justify-content: center; padding: 24px;
    }
    .card { background: #f0f0eb; border-radius: 20px; padding: 32px; max-width: 400px; width: 100%; }
    .logo { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .desc { font-size: 14px; color: #6b6b67; margin-bottom: 20px; line-height: 1.5; }
    .client { font-size: 12px; color: #6b6b67; margin-bottom: 20px; }
    .scopes { background: #e5e4df; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px; }
    .scope { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #3a3a38; }
    .dot { width: 6px; height: 6px; background: #1a1a18; border-radius: 50%; flex-shrink: 0; }
    .actions { display: flex; gap: 10px; }
    button { flex: 1; padding: 10px 16px; border-radius: 10px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; }
    .allow { background: #1a1a18; color: #fafaf7; }
    .deny { background: transparent; border: 1.5px solid #d4d4ce; color: #6b6b67; }
    .allow:hover { opacity: 0.85; }
    .deny:hover { background: #e5e4df; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Moniq</div>
    <h1>Connect Claude</h1>
    <p class="desc">Claude is requesting access to your Moniq account to submit transaction batches for your review.</p>
    ${clientName ? `<p class="client">Requested by <strong>${escHtml(clientName)}</strong></p>` : ""}
    <div class="scopes">
      <div class="scope"><div class="dot"></div>Submit transaction batches for review</div>
      <div class="scope"><div class="dot"></div>Read your categories for suggestions</div>
    </div>
    <form method="POST">
      <input type="hidden" name="client_id" value="${escHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escHtml(redirectUri)}">
      <input type="hidden" name="code_challenge" value="${escHtml(codeChallenge)}">
      <input type="hidden" name="state" value="${escHtml(state ?? "")}">
      <div class="actions">
        <button type="submit" name="action" value="deny" class="deny">Deny</button>
        <button type="submit" name="action" value="allow" class="allow">Allow</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// GET — show consent page (or redirect to login)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");
  const responseType = url.searchParams.get("response_type");

  // Validate required params
  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required parameters" },
      { status: 400 },
    );
  }

  if (responseType !== "code") {
    return NextResponse.json(
      { error: "unsupported_response_type", error_description: "Only 'code' is supported" },
      { status: 400 },
    );
  }

  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Only S256 code_challenge_method is supported" },
      { status: 400 },
    );
  }

  // Validate client
  const service = createServiceClient();
  const { data: client } = await service
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .single();

  if (!client) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "Unknown client_id" },
      { status: 400 },
    );
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uri not allowed for this client" },
      { status: 400 },
    );
  }

  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/en/login", url.origin);
    loginUrl.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(loginUrl.toString());
  }

  // Return consent page
  const html = buildConsentHtml({
    clientName: client.client_name,
    clientId,
    redirectUri,
    codeChallenge,
    state,
  });

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// POST — form submission (allow / deny)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Verify user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const action = formData.get("action") as string | null;
  const clientId = formData.get("client_id") as string | null;
  const redirectUri = formData.get("redirect_uri") as string | null;
  const codeChallenge = formData.get("code_challenge") as string | null;
  const state = formData.get("state") as string | null;

  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (action !== "allow") {
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set("error", "access_denied");
    if (state) denyUrl.searchParams.set("state", state);
    return NextResponse.redirect(denyUrl.toString());
  }

  // Insert authorization code
  const service = createServiceClient();
  const { data: codeRow, error } = await service
    .from("mcp_oauth_codes")
    .insert({
      user_id: user.id,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      scope: "mcp",
    })
    .select("code")
    .single();

  if (error || !codeRow) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const successUrl = new URL(redirectUri);
  successUrl.searchParams.set("code", codeRow.code);
  if (state) successUrl.searchParams.set("state", state);

  return NextResponse.redirect(successUrl.toString());
}
