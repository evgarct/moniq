import { afterEach, describe, expect, it } from "vitest";

import { GET as getAuthorizationServer } from "./oauth-authorization-server/route";
import { GET as getProtectedResource } from "./oauth-protected-resource/route";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("MCP OAuth discovery", () => {
  it("publishes the official Moniq resource URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://moniq.fyi";
    const response = await getProtectedResource(
      new Request("https://preview.example.dev/.well-known/oauth-protected-resource"),
    );

    await expect(response.json()).resolves.toEqual({
      resource: "https://moniq.fyi/api/mcp",
      authorization_servers: ["https://moniq.fyi"],
    });
  });

  it("publishes OAuth endpoints on the official Moniq domain", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://moniq.fyi";
    const response = await getAuthorizationServer(
      new Request("https://preview.example.dev/.well-known/oauth-authorization-server"),
    );

    await expect(response.json()).resolves.toMatchObject({
      issuer: "https://moniq.fyi",
      authorization_endpoint: "https://moniq.fyi/api/mcp/oauth/authorize",
      token_endpoint: "https://moniq.fyi/api/mcp/oauth/token",
      registration_endpoint: "https://moniq.fyi/api/mcp/oauth/register",
    });
  });

  it("uses the request origin when no app URL is configured", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const request = new Request(
      "https://preview.example.dev/.well-known/oauth-protected-resource",
    );
    const response = await getProtectedResource(request);

    await expect(response.json()).resolves.toEqual({
      resource: "https://preview.example.dev/api/mcp",
      authorization_servers: ["https://preview.example.dev"],
    });
  });
});
