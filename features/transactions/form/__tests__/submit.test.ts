import { describe, expect, it } from "vitest";

import { buildSubmitPayload, normalizePayload } from "../submit";
import type { TransactionFormInputs } from "../types";

function base(overrides: Partial<TransactionFormInputs> = {}): TransactionFormInputs {
  return {
    title: "Test",
    note: "",
    occurred_at: "2026-04-18",
    status: "paid",
    kind: "expense",
    amount: 100,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: "cat-1",
    source_account_id: "acc-1",
    destination_account_id: null,
    is_recurring: false,
    recurrence_frequency: "monthly",
    recurrence_until: null,
    line_items: [],
    ...overrides,
  };
}

import type { CurrencyCode } from "@/types/currency";

const EUR = "EUR" as CurrencyCode;

const accounts = [
  { id: "acc-1", name: "Wallet", balance: 1000, currency: EUR, type: "cash" as const, user_id: "u1", created_at: "" },
  { id: "acc-2", name: "Savings", balance: 500, currency: EUR, type: "saving" as const, user_id: "u1", created_at: "" },
];
const categories = [
  { id: "cat-1", name: "Food", type: "expense" as const, user_id: "u1", icon: null, parent_id: null, is_system: false, created_at: "" },
  { id: "cat-2", name: "Salary", type: "income" as const, user_id: "u1", icon: null, parent_id: null, is_system: false, created_at: "" },
];

describe("normalizePayload", () => {
  it("trims whitespace from title and note", () => {
    const result = normalizePayload(base({ title: "  Test  ", note: "  a note  " }));
    expect(result.title).toBe("Test");
    expect(result.note).toBe("a note");
  });

  it("sets note to null when empty", () => {
    const result = normalizePayload(base({ note: "   " }));
    expect(result.note).toBeNull();
  });

  it("strips destination_amount for non-move kinds", () => {
    const result = normalizePayload(base({ kind: "expense", destination_amount: 99 }));
    expect(result.destination_amount).toBeNull();
  });

  it("includes destination_amount for transfer", () => {
    const result = normalizePayload(base({ kind: "transfer", destination_account_id: "acc-2", destination_amount: 90 }));
    expect(result.destination_amount).toBe(90);
  });

  it("falls back destination_amount to amount for transfer when null", () => {
    const result = normalizePayload(base({ kind: "transfer", destination_account_id: "acc-2", destination_amount: null }));
    expect(result.destination_amount).toBe(100);
  });

  it("includes debt breakdown for debt_payment", () => {
    const result = normalizePayload(
      base({ kind: "debt_payment", destination_account_id: "acc-2", principal_amount: 80, interest_amount: 15, extra_principal_amount: 5 }),
    );
    expect(result.principal_amount).toBe(80);
    expect(result.interest_amount).toBe(15);
    expect(result.extra_principal_amount).toBe(5);
  });
});

describe("buildSubmitPayload – add income single (non-batch kind)", () => {
  it("returns entry payload", () => {
    const values = base({ kind: "income", source_account_id: null, destination_account_id: "acc-2" });
    const payload = buildSubmitPayload(values, "add", accounts, categories);
    expect(payload?.kind).toBe("entry");
    if (payload?.kind === "entry") {
      expect(payload.values.kind).toBe("income");
      expect(payload.values.recurrence).toBeNull();
    }
  });

  it("infers title from category name for income", () => {
    const values = base({ kind: "income", category_id: "cat-2", source_account_id: null, destination_account_id: "acc-2" });
    const payload = buildSubmitPayload(values, "add", accounts, categories);
    if (payload?.kind === "entry") {
      expect(payload.values.title).toBe("Salary");
    }
  });
});

describe("buildSubmitPayload – add expense batch", () => {
  it("returns entry-batch payload with one entry per line item", () => {
    const values = base({
      kind: "expense",
      source_account_id: "acc-1",
      line_items: [
        { category_id: "cat-1", amount: 30, note: "" },
        { category_id: "cat-1", amount: 70, note: "lunch" },
      ],
    });
    const payload = buildSubmitPayload(values, "add", accounts, categories);
    expect(payload?.kind).toBe("entry-batch");
    if (payload?.kind === "entry-batch") {
      expect(payload.values.entries).toHaveLength(2);
      expect(payload.values.entries[0].amount).toBe(30);
      expect(payload.values.entries[1].amount).toBe(70);
    }
  });
});

describe("buildSubmitPayload – edit-transaction", () => {
  it("returns transaction payload", () => {
    const result = buildSubmitPayload(base(), "edit-transaction", accounts, categories);
    expect(result?.kind).toBe("transaction");
  });
});

describe("buildSubmitPayload – edit-schedule", () => {
  it("returns schedule payload with recurrence", () => {
    const result = buildSubmitPayload(
      base({ is_recurring: true, status: "planned", recurrence_frequency: "weekly" }),
      "edit-schedule",
      accounts,
      categories,
    );
    expect(result?.kind).toBe("schedule");
    if (result?.kind === "schedule") {
      expect(result.values.recurrence.frequency).toBe("weekly");
    }
  });
});

describe("buildSubmitPayload – recurring add entry", () => {
  it("includes recurrence when is_recurring is true", () => {
    const result = buildSubmitPayload(
      base({ kind: "income", source_account_id: null, destination_account_id: "acc-2", is_recurring: true, status: "planned", recurrence_frequency: "monthly", recurrence_until: "2026-12-31" }),
      "add",
      accounts,
      categories,
    );
    expect(result?.kind).toBe("entry");
    if (result?.kind === "entry") {
      expect(result.values.recurrence?.frequency).toBe("monthly");
      expect(result.values.recurrence?.until_date).toBe("2026-12-31");
    }
  });
});
