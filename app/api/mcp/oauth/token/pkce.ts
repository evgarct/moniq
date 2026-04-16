/**
 * PKCE S256 utility — extracted for testability.
 */

export async function verifyPkce(
  codeVerifier: string,
  storedChallenge: string,
): Promise<boolean> {
  const encoded = new TextEncoder().encode(codeVerifier);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hashBuf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return b64 === storedChallenge;
}

export function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "mnq_" + hex;
}

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build the S256 code_challenge from a verifier (for test helpers). */
export async function buildChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
