export const CANONICAL_APP_URL = "https://moniq.fyi";

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || CANONICAL_APP_URL).replace(/\/+$/, "");
}

export function getMcpUrl() {
  return `${getAppUrl()}/api/mcp`;
}

export function getMcpResourceMetadataUrl() {
  return `${getAppUrl()}/.well-known/oauth-protected-resource`;
}
