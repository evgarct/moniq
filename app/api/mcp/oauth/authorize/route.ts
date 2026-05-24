import { NextResponse } from "next/server";
import { localizedOAuthErrorResponse } from "@/app/api/_lib/error-response";
import { detectRequestLocale } from "@/i18n/locale";
import { getRequestTranslator } from "@/i18n/translator";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

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
  locale,
  title,
  heading,
  description,
  requestedBy,
  submitScope,
  readScope,
  deny,
  allow,
}: {
  clientName: string | null;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  locale: string;
  title: string;
  heading: string;
  description: string;
  requestedBy: string;
  submitScope: string;
  readScope: string;
  deny: string;
  allow: string;
}): string {
  return `<!DOCTYPE html>
<html lang="${escHtml(locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
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
    <h1>${escHtml(heading)}</h1>
    <p class="desc">${escHtml(description)}</p>
    ${clientName ? `<p class="client">${escHtml(requestedBy)} <strong>${escHtml(clientName)}</strong></p>` : ""}
    <div class="scopes">
      <div class="scope"><div class="dot"></div>${escHtml(submitScope)}</div>
      <div class="scope"><div class="dot"></div>${escHtml(readScope)}</div>
    </div>
    <form method="POST">
      <input type="hidden" name="client_id" value="${escHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escHtml(redirectUri)}">
      <input type="hidden" name="code_challenge" value="${escHtml(codeChallenge)}">
      <input type="hidden" name="state" value="${escHtml(state ?? "")}">
      <div class="actions">
        <button type="submit" name="action" value="deny" class="deny">${escHtml(deny)}</button>
        <button type="submit" name="action" value="allow" class="allow">${escHtml(allow)}</button>
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
  const locale = detectRequestLocale(request);
  const t = (await getRequestTranslator(request)) as (key: string) => string;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");
  const responseType = url.searchParams.get("response_type");

  // Validate required params
  if (!clientId || !redirectUri || !codeChallenge) {
    return localizedOAuthErrorResponse(request, "invalid_request", "common.errors.oauth.missingRequiredParameters", 400);
  }

  if (responseType !== "code") {
    return localizedOAuthErrorResponse(request, "unsupported_response_type", "common.errors.oauth.onlyCodeSupported", 400);
  }

  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return localizedOAuthErrorResponse(request, "invalid_request", "common.errors.oauth.onlyS256Supported", 400);
  }

  // Validate client via RPC (no service role needed)
  const db = createAnonClient();
  const { data: clientRows } = await db.rpc("mcp_oauth_get_client", { p_client_id: clientId });
  const client = clientRows && clientRows.length > 0 ? clientRows[0] : null;

  if (!client) {
    return localizedOAuthErrorResponse(request, "invalid_client", "common.errors.oauth.unknownClient", 400);
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    return localizedOAuthErrorResponse(request, "invalid_request", "common.errors.oauth.redirectUriNotAllowed", 400);
  }

  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(`/${locale}/login`, url.origin);
    loginUrl.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  // Return consent page
  const html = buildConsentHtml({
    clientName: client.client_name,
    clientId,
    redirectUri,
    codeChallenge,
    state,
    locale,
    title: t("settings.mcp.oauthConsent.title"),
    heading: t("settings.mcp.oauthConsent.heading"),
    description: t("settings.mcp.oauthConsent.description"),
    requestedBy: t("settings.mcp.oauthConsent.requestedBy"),
    submitScope: t("settings.mcp.oauthConsent.scopes.submit"),
    readScope: t("settings.mcp.oauthConsent.scopes.read"),
    deny: t("settings.mcp.oauthConsent.actions.deny"),
    allow: t("settings.mcp.oauthConsent.actions.allow"),
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
    return localizedOAuthErrorResponse(request, "unauthorized", null, 401);
  }

  const formData = await request.formData();
  const action = formData.get("action") as string | null;
  const clientId = formData.get("client_id") as string | null;
  const redirectUri = formData.get("redirect_uri") as string | null;
  const codeChallenge = formData.get("code_challenge") as string | null;
  const state = formData.get("state") as string | null;

  if (!clientId || !redirectUri || !codeChallenge) {
    return localizedOAuthErrorResponse(request, "invalid_request", null, 400);
  }

  if (action !== "allow") {
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set("error", "access_denied");
    if (state) denyUrl.searchParams.set("state", state);
    return NextResponse.redirect(denyUrl.toString(), 303);
  }

  // Issue authorization code via RPC (no service role needed)
  const db = createAnonClient();
  const { data: code, error } = await db.rpc("mcp_oauth_issue_code", {
    p_user_id: user.id,
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
    p_code_challenge: codeChallenge,
    p_scope: "mcp",
  });

  if (error || !code) {
    return localizedOAuthErrorResponse(request, "server_error", null, 500);
  }

  const successUrl = new URL(redirectUri);
  successUrl.searchParams.set("code", code as string);
  if (state) successUrl.searchParams.set("state", state);

  return NextResponse.redirect(successUrl.toString(), 303);
}
