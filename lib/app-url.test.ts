import { afterEach, describe, expect, it } from "vitest";

import {
  CANONICAL_APP_URL,
  getAppUrl,
  getMcpResourceMetadataUrl,
  getMcpUrl,
} from "@/lib/app-url";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("canonical app URL", () => {
  it("defaults to the official Moniq domain", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getAppUrl()).toBe(CANONICAL_APP_URL);
    expect(getMcpUrl()).toBe("https://moniq.fyi/api/mcp");
    expect(getMcpResourceMetadataUrl()).toBe(
      "https://moniq.fyi/.well-known/oauth-protected-resource",
    );
  });

  it("preserves the current deployment origin when provided", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getAppUrl("https://preview.example.dev/")).toBe("https://preview.example.dev");
    expect(getMcpUrl("http://localhost:3008")).toBe("http://localhost:3008/api/mcp");
    expect(getMcpResourceMetadataUrl("https://preview.example.dev")).toBe(
      "https://preview.example.dev/.well-known/oauth-protected-resource",
    );
  });

  it("normalizes a configured app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://preview.moniq.fyi/";

    expect(getAppUrl("http://localhost:3008")).toBe("https://preview.moniq.fyi");
  });
});
