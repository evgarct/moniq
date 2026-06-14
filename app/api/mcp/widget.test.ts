import { describe, expect, it } from "vitest";

import { MONIQ_WIDGET_URI, moniqWidgetHtml, type MoniqWidgetCopy } from "./widget";

const COPY: MoniqWidgetCopy = {
  locale: "en",
  numberLocale: "en-GB",
  transactions: "Transactions",
  balances: "Balances",
  report: "Category report",
  recurring: "Recurring transactions",
  result: "Moniq result",
  empty: "Nothing to show",
  more: "more",
  count: "Count",
  paid: "Paid",
  planned: "Planned",
  skipped: "Skipped",
  active: "Active",
  paused: "Paused",
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  debt_payment: "Debt payment",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  principal: "principal",
  interest: "interest",
  extra: "extra principal",
};

describe("Moniq MCP widget", () => {
  it("uses the MCP Apps result notification with a ChatGPT fallback", () => {
    const html = moniqWidgetHtml(COPY);

    expect(MONIQ_WIDGET_URI).toBe("ui://moniq/finance-result.html");
    expect(html).toContain("ui/notifications/tool-result");
    expect(html).toContain("window.openai");
  });

  it("renders compact rows with localized finance labels", () => {
    const html = moniqWidgetHtml(COPY);

    expect(html).toContain("grid-template-columns: minmax(0,1fr) auto");
    expect(html).toContain('"debt_payment":"Debt payment"');
    expect(html).toContain("source_account_name");
    expect(html).toContain("category_path");
    expect(html).toContain("principal_amount");
    expect(html).toContain("MAX_ROWS = 8");
  });

  it("renders expense, income, and uncategorized report groups", () => {
    const html = moniqWidgetHtml(COPY);

    expect(html).toContain("data.income_categories");
    expect(html).toContain("data.uncategorized");
    expect(html).toContain("...(data.envelopes || [])");
    expect(html).toContain("title: label(entry.kind)");
  });

  it("uses request-scoped copy without a client-side locale dictionary", () => {
    const html = moniqWidgetHtml({
      ...COPY,
      locale: "ru",
      numberLocale: "ru-RU",
      empty: "Нет данных",
      debt_payment: "Платёж по долгу",
    });

    expect(html).toContain('"empty":"Нет данных"');
    expect(html).toContain('"debt_payment":"Платёж по долгу"');
    expect(html).not.toContain("navigator.language");
    expect(html).not.toContain("const locale =");
  });

  it("does not render technical identifiers", () => {
    const html = moniqWidgetHtml(COPY);

    expect(html).not.toContain("category_id");
    expect(html).not.toContain("source_account_id");
    expect(html).not.toContain("destination_account_id");
    expect(html).not.toContain("schedule_id");
  });
});
