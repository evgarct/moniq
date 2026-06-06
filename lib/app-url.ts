export const CANONICAL_APP_URL = "https://moniq.fyi";

export function getAppUrl(currentOrigin = CANONICAL_APP_URL) {
  return (process.env.NEXT_PUBLIC_APP_URL || currentOrigin).replace(/\/+$/, "");
}

export function getMcpUrl(currentOrigin?: string) {
  return `${getAppUrl(currentOrigin)}/api/mcp`;
}

export function getMcpResourceMetadataUrl(currentOrigin?: string) {
  return `${getAppUrl(currentOrigin)}/.well-known/oauth-protected-resource`;
}
