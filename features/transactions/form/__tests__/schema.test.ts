import { describe, expect, it } from "vitest";

import { buildSchema } from "../schema";

const msgs = {
  validation: {
    noteMax: "noteMax",
    dateRequired: "dateRequired",
    amountPositive: "amountPositive",
    destinationAmountPositive: "destinationAmountPositive",
    fxRatePositive: "fxRatePositive",
    principalMin: "principalMin",
    interestMin: "interestMin",
    extraMin: "extraMin",
    sourceRequired: "sourceRequired",
    destinationRequired: "destinationRequired",
    categoryRequired: "categoryRequired",
    goalRequired: "goalRequired",
    differentDestination: "differentDestination",
    debtBreakdownRequired: "debtBreakdownRequired",
    debtBreakdownMismatch: "debtBreakdownMismatch",
    destinationAmountRequired: "destinationAmountRequired",
    lineItemsRequired: "lineItemsRequired",
    recurringMustBePlanned: "recurringMustBePlanned",
    recurrenceUntilBeforeStart: "recurrenceUntilBeforeStart",
    adjustmentBalanceRequired: "adjustmentBalanceRequired",
    adjustmentNoDiff: "adjustmentNoDiff",
  },
};

function base(overrides = {}) {
  return {
    title: "Test",
    note: "",
    occurred_at: "2026-04-18",
    status: "paid" as const,
    kind: "expense" as const,
    amount: 100,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: "cat-1",
    source_account_id: "acc-1",
    destination_account_id: null,
    allocation_id: null,
    is_recurring: false,
    recurrence_frequency: "monthly" as const,
    recurrence_until: null,
    line_items: [],
    adjustment_target_balance: null,
    ...overrides,
  };
}

describe("buildSchema – add mode", () => {
  const schema = buildSchema(msgs, "add");

  it("accepts a valid expense in batch mode", () => {
    // In add mode, expense is always batch — must have at least one line item
    const result = schema.safeParse(
      base({
        line_items: [{ category_id: "cat-1", allocation_id: null, amount: 100, note: "" }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts batch expense with amount=0 at top level (realistic form default)", () => {
    // The form initialises amount=0; user fills only line_items — top-level amount must be ignored
    const result = schema.safeParse(
      base({
        amount: 0, // ← реальный дефолт useForm
        line_items: [{ category_id: "cat-1", allocation_id: null, amount: 100, note: "" }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("still rejects non-batch kind with amount=0", () => {
    // transfer is not a batch kind — top-level amount must be positive
    const result = schema.safeParse(
      base({
        kind: "transfer",
        amount: 0,
        destination_account_id: "acc-2",
        destination_amount: 0,
        line_items: [],
      }),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("amount");
  });

  it("rejects expense without source_account_id", () => {
    const result = schema.safeParse(base({ source_account_id: null }));
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("source_account_id");
  });

  it("rejects income without destination_account_id", () => {
    const result = schema.safeParse(
      base({ kind: "income", source_account_id: null, destination_account_id: null }),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("destination_account_id");
  });

  it("rejects same source and destination account", () => {
    const result = schema.safeParse(
      base({ kind: "transfer", source_account_id: "acc-1", destination_account_id: "acc-1", destination_amount: 100 }),
    );
    expect(result.success).toBe(false);
    const msgs2 = result.error!.issues.map((i) => i.message);
    expect(msgs2).toContain("differentDestination");
  });

  it("rejects transfer without destination_amount", () => {
    const result = schema.safeParse(
      base({ kind: "transfer", destination_account_id: "acc-2", destination_amount: null }),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("destination_amount");
  });

  it("accepts save_to_goal with allocation in batch mode (no allocation_id required)", () => {
    const result = schema.safeParse(
      base({
        kind: "save_to_goal",
        source_account_id: "acc-1",
        destination_account_id: "acc-2",
        destination_amount: 50,
        allocation_id: null,
        category_id: null,
        line_items: [{ category_id: null, allocation_id: "goal-1", amount: 50, note: "" }],
      }),
    );
    // batch mode: allocation_id not required at top level
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).not.toContain("allocation_id");
  });

  it("rejects batch save_to_goal line item without allocation_id", () => {
    // In add mode, save_to_goal is batch — line items must have allocation_id
    const result = schema.safeParse(
      base({
        kind: "save_to_goal",
        source_account_id: "acc-1",
        destination_account_id: "acc-2",
        destination_amount: 50,
        allocation_id: null,
        category_id: null,
        line_items: [{ category_id: null, allocation_id: null, amount: 50, note: "" }],
      }),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("line_items.0.allocation_id");
  });

  it("rejects debt_payment when breakdown does not sum to amount", () => {
    const result = schema.safeParse(
      base({
        kind: "debt_payment",
        amount: 1000,
        source_account_id: "acc-1",
        destination_account_id: "acc-2",
        category_id: null,
        principal_amount: 800,
        interest_amount: 100,
        extra_principal_amount: 0,
      }),
    );
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toContain("debtBreakdownMismatch");
  });

  it("accepts debt_payment when breakdown sums to amount", () => {
    const result = schema.safeParse(
      base({
        kind: "debt_payment",
        amount: 1000,
        source_account_id: "acc-1",
        destination_account_id: "acc-2",
        category_id: null,
        principal_amount: 800,
        interest_amount: 150,
        extra_principal_amount: 50,
      }),
    );
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).not.toContain("amount");
  });

  it("rejects recurring transaction with status paid", () => {
    const result = schema.safeParse(
      base({ is_recurring: true, status: "paid" }),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("status");
  });

  it("rejects recurrence_until before occurred_at", () => {
    const result = schema.safeParse(
      base({
        is_recurring: true,
        status: "planned",
        occurred_at: "2026-05-01",
        recurrence_until: "2026-04-01",
      }),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("recurrence_until");
  });

  it("rejects batch mode with no line items", () => {
    // expense in add mode is always batch — empty line_items should fail
    const result = schema.safeParse(
      base({ kind: "expense", line_items: [] }),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("line_items");
  });

  it("accepts adjustment with target balance", () => {
    const result = schema.safeParse(
      base({
        kind: "adjustment",
        source_account_id: "acc-1",
        destination_account_id: null,
        category_id: null,
        adjustment_target_balance: 500,
        amount: 1, // will be computed externally
      }),
    );
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).not.toContain("adjustment_target_balance");
    expect(paths).not.toContain("source_account_id");
  });
});

describe("buildSchema – edit-transaction mode", () => {
  const schema = buildSchema(msgs, "edit-transaction");

  it("accepts a valid single expense edit", () => {
    const result = schema.safeParse(base());
    expect(result.success).toBe(true);
  });

  it("does not apply batch validation in edit mode", () => {
    // Even for expense with empty line_items, edit mode should not require line_items
    const result = schema.safeParse(base({ kind: "expense", line_items: [] }));
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).not.toContain("line_items");
  });
});
