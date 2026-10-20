import { describe, expect, it } from "vitest";

import { getSpendableAccounts } from "./account-utils";

describe("getSpendableAccounts", () => {
  it("excludes locked pension accounts and keeps everything else in order", () => {
    const accounts = [
      { id: "a", type: "cash" as const },
      { id: "dps", type: "pension" as const },
      { id: "b", type: "saving" as const },
      { id: "c", type: "credit_card" as const },
    ];

    expect(getSpendableAccounts(accounts).map((account) => account.id)).toEqual(["a", "b", "c"]);
  });
});
