import { beforeEach, describe, expect, it, vi } from "vitest";

let userId: string | null = "pilot-user";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })) },
  })),
}));

describe("GET /api/sync/bootstrap", () => {
  beforeEach(() => {
    userId = "pilot-user";
    delete process.env.NEXT_PUBLIC_LOCAL_FIRST_MODE;
    delete process.env.LOCAL_FIRST_PILOT_USER_IDS;
    delete process.env.NEXT_PUBLIC_POWERSYNC_URL;
  });

  it("does not disclose configuration to unauthenticated callers", async () => {
    userId = null;
    const { GET } = await import("@/app/api/sync/bootstrap/route");
    expect((await GET()).status).toBe(401);
  });

  it("enables only allowlisted users in pilot mode", async () => {
    process.env.NEXT_PUBLIC_LOCAL_FIRST_MODE = "pilot";
    process.env.LOCAL_FIRST_PILOT_USER_IDS = "pilot-user, another-user";
    process.env.NEXT_PUBLIC_POWERSYNC_URL = "https://sync.example.test";
    const { GET } = await import("@/app/api/sync/bootstrap/route");
    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({ enabled: true, mode: "pilot", userId: "pilot-user", powersyncUrl: "https://sync.example.test" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps PowerSync details hidden when local-first is disabled", async () => {
    process.env.NEXT_PUBLIC_LOCAL_FIRST_MODE = "off";
    process.env.NEXT_PUBLIC_POWERSYNC_URL = "https://sync.example.test";
    const { GET } = await import("@/app/api/sync/bootstrap/route");
    const body = await (await GET()).json();

    expect(body).toMatchObject({ enabled: false, mode: "off", powersyncUrl: null });
  });
});
