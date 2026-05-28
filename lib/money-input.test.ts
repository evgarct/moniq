import { describe, expect, it } from "vitest";

import {
  formatMoneyInputValue,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "./money-input";

describe("money input helpers", () => {
  it("normalizes comma decimal input", () => {
    expect(sanitizeMoneyInput("12,34")).toBe("12.34");
    expect(parseMoneyInput("12,34")).toBe(12.34);
  });

  it("removes non-numeric characters", () => {
    expect(sanitizeMoneyInput("CZK 1 200.50")).toBe("1200.50");
    expect(parseMoneyInput("CZK 1 200.50")).toBe(1200.5);
  });

  it("keeps only one decimal separator", () => {
    expect(sanitizeMoneyInput("1.2.3")).toBe("1.23");
    expect(parseMoneyInput("1.2.3")).toBe(1.23);
  });

  it("treats empty drafts as null", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput(".")).toBeNull();
  });

  it("formats nullable controlled values for display", () => {
    expect(formatMoneyInputValue(undefined)).toBe("");
    expect(formatMoneyInputValue(null)).toBe("");
    expect(formatMoneyInputValue(0)).toBe("0");
    expect(formatMoneyInputValue(100)).toBe("100");
  });
});
