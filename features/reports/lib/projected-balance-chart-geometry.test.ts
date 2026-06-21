import { describe, expect, it } from "vitest";

import { buildStepPath, getProjectedBalanceRange, projectBalancePoints } from "./projected-balance-chart-geometry";

const points = [
  { date: "2026-01-01", balance: 100, accounts: [], operations: [] },
  { date: "2026-01-02", balance: 80, accounts: [], operations: [] },
  { date: "2026-01-03", balance: 120, accounts: [], operations: [] },
];

describe("projected balance chart geometry", () => {
  it("pads the visible value range", () => {
    const range = getProjectedBalanceRange([{ points }]);
    expect(range.min).toBeLessThan(80);
    expect(range.max).toBeGreaterThan(120);
  });

  it("returns a finite range for an empty report", () => {
    expect(getProjectedBalanceRange([])).toEqual({ min: 0, max: 1 });
  });

  it("builds an SVG step path", () => {
    const projected = projectBalancePoints({
      points,
      min: 0,
      max: 120,
      width: 300,
      height: 200,
      left: 20,
      right: 20,
      top: 10,
      bottom: 20,
    });

    expect(buildStepPath(projected)).toMatch(/^M .+ H .+ V .+ H .+ V .+$/);
    expect(projected[0].x).toBe(20);
    expect(projected.at(-1)?.x).toBe(280);
  });
});
