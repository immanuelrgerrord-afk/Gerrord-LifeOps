import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTransactionText } from "./transaction-import.ts";

const categories = [
  { name: "Food", kind: "expense" as const },
  { name: "Shopping", kind: "expense" as const },
  { name: "Investment", kind: "expense" as const },
  { name: "Utilities", kind: "expense" as const },
  { name: "Bills", kind: "expense" as const },
  { name: "Fuel", kind: "expense" as const },
  { name: "Other", kind: "expense" as const },
  { name: "Salary", kind: "income" as const },
  { name: "Other", kind: "income" as const },
];

describe("parseTransactionText", () => {
  it("parses the user's pasted month list and suggests useful categories", () => {
    const result = parseTransactionText(
      `November expenses
Received-173416
Road side momos-120
Family dinner-700
Crest Home windowscreen rod-665
Zomato kfc chithi home-820
Dinner-600
Gerry chew-269
Grilled-130`,
      { defaultDate: "2026-11-20", categories },
    );

    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 8);
    assert.equal(result.rows[0].kind, "income");
    assert.equal(result.rows[0].amount, 173416);
    assert.equal(result.rows[0].date, "2026-11-01");
    assert.deepEqual(
      result.rows.slice(1).map((row) => row.category),
      ["Food", "Food", "Shopping", "Food", "Food", "Food", "Food"],
    );
  });

  it("parses the October 2026 sample, identifies return income, and retains the monthly RD", () => {
    const sample = `October expenses 2026
Received:128371
Dad(bike,wifi,water purifier,mobile emi)-6850
Reema cc return-11172
Mom (Home,Seetu,last month 2.5k)-28500
Hdfc card-708
Reema Hay Dress-1500
G drive-180
Royal emirates dinner-665
Rd for car icici account 1 year-3000 per month
Post office ppf-2150
Withdrawn for crest drainage-10000
Crust and co family dinner-1616
Amazon (int,car tyre,glass)-1041
Amazon (car cable,mitt,car foam)-858
Snacks-65
Grill family-250
Juice-288
Lunch-608
Tea-35
Dashcam sd card-2122
Diesel-1328`;
    const result = parseTransactionText(sample, { defaultDate: "2026-11-20", categories });
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 21);
    assert.ok(result.rows.every((row) => row.date === "2026-10-01"));
    assert.equal(result.rows[0].kind, "income");
    assert.equal(result.rows[0].amount, 128371);
    assert.equal(result.rows[2].kind, "income");
    assert.equal(result.rows[2].amount, 11172);
    assert.equal(result.rows[8].recurrence, "monthly");
    assert.equal(result.rows[8].months, 12);
    assert.equal(result.rows[8].category, "Investment");
    assert.equal(result.rows[9].category, "Investment");
    assert.equal(result.rows[10].category, "Utilities");
    assert.equal(result.rows[14].category, "Food");
    assert.equal(result.rows[20].category, "Fuel");
  });

  it("supports CSV date/description/amount columns and signed income", () => {
    const result = parseTransactionText(
      "date,description,amount\n2026-11-12,Groceries,1200.50\n2026-11-13,Refund,-250",
      { defaultDate: "2026-11-20", categories },
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows[0].date, "2026-11-12");
    assert.equal(result.rows[0].amount, 1200.5);
    assert.equal(result.rows[1].kind, "income");
    assert.equal(result.rows[1].amount, 250);
  });

  it("flags existing and within-file duplicates", () => {
    const text = "Dinner-600\nDinner-600";
    const result = parseTransactionText(text, {
      defaultDate: "2026-11-20",
      categories,
      existing: [
        { title: "Dinner", amount: 600, date: "2026-11-20T12:00:00.000Z", kind: "expense" },
      ],
    });
    assert.deepEqual(
      result.rows.map((row) => row.duplicate),
      [true, true],
    );
  });

  it("reports malformed rows and uses learned category corrections", () => {
    const result = parseTransactionText("Dinner-600\nno amount here", {
      defaultDate: "2026-11-20",
      categories,
      learned: { "expense:dinner": "Shopping" },
    });
    assert.equal(result.rows[0].category, "Shopping");
    assert.equal(result.errors.length, 1);
  });
});
