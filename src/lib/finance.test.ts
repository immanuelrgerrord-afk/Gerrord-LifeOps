import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, calcEMI, emiDueDate, emiDueYm, simulatePrepayment } from "./finance.ts";

describe("loan calculations", () => {
  it("clamps EMI due dates to the last day of short months", () => {
    const february = emiDueDate("2026-01-31", 1);
    assert.equal(february.getFullYear(), 2026);
    assert.equal(february.getMonth(), 1);
    assert.equal(february.getDate(), 28);
    assert.equal(emiDueYm("2026-01-31", 1), "2026-02");
    assert.equal(emiDueDate("2024-01-31", 1).getDate(), 29);
  });

  it("handles invalid inputs and builds a zero-interest amortization schedule", () => {
    assert.equal(calcEMI(0, 8, 12), 0);
    assert.equal(calcEMI(12000, -1, 12), 0);
    assert.equal(calcEMI(12000, 0, 12), 1000);
    const schedule = buildSchedule(12000, 0, 12, "2026-01-31");
    assert.equal(schedule.length, 12);
    assert.equal(schedule[11].balance, 0);
    assert.equal(schedule[1].ym, "2026-02");
  });

  it("simulates prepayment with no more interest than the baseline", () => {
    const result = simulatePrepayment(1_000_000, 9, 240, "2020-01-31", "2020-01", 5000, null);
    assert.ok(result.monthsSaved > 0);
    assert.ok(result.interestSaved > 0);
    assert.ok(result.newTotalInterest <= result.baselineTotalInterest);
  });
});
