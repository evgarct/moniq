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

  it("normalizes a configured app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://preview.moniq.fyi/";

    expect(getAppUrl()).toBe("https://preview.moniq.fyi");
  });
});
