import { describe, expect, it } from "vitest";

import { GET as getAuthorizationServer } from "./oauth-authorization-server/route";
import { GET as getProtectedResource } from "./oauth-protected-resource/route";

describe("MCP OAuth discovery", () => {
  it("publishes the official Moniq resource URL", async () => {
    const response = await getProtectedResource();

    await expect(response.json()).resolves.toEqual({
      resource: "https://moniq.fyi/api/mcp",
      authorization_servers: ["https://moniq.fyi"],
    });
  });

  it("publishes OAuth endpoints on the official Moniq domain", async () => {
    const response = await getAuthorizationServer();

    await expect(response.json()).resolves.toMatchObject({
      issuer: "https://moniq.fyi",
      authorization_endpoint: "https://moniq.fyi/api/mcp/oauth/authorize",
      token_endpoint: "https://moniq.fyi/api/mcp/oauth/token",
      registration_endpoint: "https://moniq.fyi/api/mcp/oauth/register",
    });
  });
});
