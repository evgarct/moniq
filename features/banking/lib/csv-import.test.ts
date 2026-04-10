import { describe, expect, it } from "vitest";

import { parseCsvTransactions } from "@/features/banking/lib/csv-import";

describe("csv-import", () => {
  it("parses a simple comma-separated bank export", () => {
    const rows = parseCsvTransactions({
      csvText: [
        "date,merchant,amount,currency,transaction_id",
        "2026-04-09,Albert Praha,-12.45,CZK,txn-1",
        "2026-04-10,Salary,25000,CZK,txn-2",
      ].join("\n"),
      walletId: "wallet-1",
      fallbackCurrency: "CZK",
    });

    expect(rows).toEqual([
      {
        walletId: "wallet-1",
        rowIndex: 1,
        transactionId: "txn-1",
        amount: -12.45,
        currency: "CZK",
        date: "2026-04-09",
        merchant: "Albert Praha",
      },
      {
        walletId: "wallet-1",
        rowIndex: 2,
        transactionId: "txn-2",
        amount: 25000,
        currency: "CZK",
        date: "2026-04-10",
        merchant: "Salary",
      },
    ]);
  });

  it("supports semicolon exports with debit and credit columns", () => {
    const rows = parseCsvTransactions({
      csvText: [
        "booking_date;description;debit;credit",
        "10.04.2026;Lidl Praha;499,90;",
        "11.04.2026;Refund;;120,00",
      ].join("\n"),
      walletId: "wallet-2",
      fallbackCurrency: "EUR",
    });

    expect(rows.map((row) => ({ amount: row.amount, date: row.date, merchant: row.merchant }))).toEqual([
      { amount: -499.9, date: "2026-04-10", merchant: "Lidl Praha" },
      { amount: 120, date: "2026-04-11", merchant: "Refund" },
    ]);
  });
});
