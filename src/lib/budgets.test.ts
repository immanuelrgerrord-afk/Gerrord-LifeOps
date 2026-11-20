import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getBudgetProgress } from "./budgets.ts";

describe("monthly budget progress", () => {
  it("reports remaining money under the limit", () => {
    assert.deepEqual(getBudgetProgress(650, 1000), {
      limit: 1000,
      spent: 650,
      remaining: 350,
      overBy: 0,
      percent: 65,
      progressPercent: 65,
      isOver: false,
    });
  });

  it("reports overspend and caps the progress bar at 100 percent", () => {
    const progress = getBudgetProgress(1250, 1000);
    assert.equal(progress.remaining, 0);
    assert.equal(progress.overBy, 250);
    assert.equal(progress.percent, 125);
    assert.equal(progress.progressPercent, 100);
    assert.equal(progress.isOver, true);
  });

  it("treats invalid or zero inputs safely", () => {
    const progress = getBudgetProgress(Number.NaN, 0);
    assert.equal(progress.spent, 0);
    assert.equal(progress.percent, 0);
    assert.equal(progress.isOver, false);
  });
});
