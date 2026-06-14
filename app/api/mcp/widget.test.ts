import { describe, expect, it } from "vitest";

import { MONIQ_WIDGET_URI, moniqWidgetHtml } from "./widget";

describe("Moniq MCP widget", () => {
  it("uses the MCP Apps result notification with a ChatGPT fallback", () => {
    const html = moniqWidgetHtml();

    expect(MONIQ_WIDGET_URI).toBe("ui://moniq/finance-result.html");
    expect(html).toContain("ui/notifications/tool-result");
    expect(html).toContain("window.openai");
  });

  it("renders compact rows with localized finance labels", () => {
    const html = moniqWidgetHtml();

    expect(html).toContain("grid-template-columns: minmax(0,1fr) auto");
    expect(html).toContain('debt_payment: "Платёж по долгу"');
    expect(html).toContain("source_account_name");
    expect(html).toContain("category_path");
    expect(html).toContain("principal_amount");
    expect(html).toContain("MAX_ROWS = 8");
  });

  it("does not render technical identifiers", () => {
    const html = moniqWidgetHtml();

    expect(html).not.toContain("category_id");
    expect(html).not.toContain("source_account_id");
    expect(html).not.toContain("destination_account_id");
    expect(html).not.toContain("schedule_id");
  });
});
