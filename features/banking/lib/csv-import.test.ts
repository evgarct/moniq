import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

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
        kind: "expense",
      },
      {
        walletId: "wallet-1",
        rowIndex: 2,
        transactionId: "txn-2",
        amount: 25000,
        currency: "CZK",
        date: "2026-04-10",
        merchant: "Salary",
        kind: "income",
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

  it("parses the KB card movements export format", () => {
    const rows = parseCsvTransactions({
      csvText: [
        "Card number;Card holder;Transaction date;Posting date;Transaction type;Original amount;Original currency;Posting amount;Posting currency;Exchange rate;Description;Note;Merchant;City",
        '"531533XXXXXX2587";"Evgenii Safronov";"9. 4. 2026";"9. 4. 2026";"Client&#39;s repayment";"";"";"23582,32";"CZK";"";"Client Payment";"";"";""',
        '"531533XXXXXX2587";"Evgenii Safronov";"8. 4. 2026";"9. 4. 2026";"Payment at a merchant Apple pay";"";"";"-150";"CZK";"";"Dock";"";"";""',
        '"531533XXXXXX2587";"Evgenii Safronov";"6. 4. 2026";"7. 4. 2026";"Internet payment Apple pay";"";"";"-812,2";"CZK";"";"Wolt";"";"Wolt";""',
      ].join("\n"),
      walletId: "wallet-kb",
      fallbackCurrency: "CZK",
    });

    expect(rows).toEqual([
      {
        walletId: "wallet-kb",
        rowIndex: 1,
        transactionId: null,
        amount: 23582.32,
        currency: "CZK",
        date: "2026-04-09",
        merchant: "Client Payment",
        kind: "income",
      },
      {
        walletId: "wallet-kb",
        rowIndex: 2,
        transactionId: null,
        amount: -150,
        currency: "CZK",
        date: "2026-04-09",
        merchant: "Dock",
        kind: "expense",
      },
      {
        walletId: "wallet-kb",
        rowIndex: 3,
        transactionId: null,
        amount: -812.2,
        currency: "CZK",
        date: "2026-04-07",
        merchant: "Wolt",
        kind: "expense",
      },
    ]);
  });

  it("parses account statement exports with started and completed dates", () => {
    const rows = parseCsvTransactions({
      csvText: [
        "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
        "Card Payment,Current,2026-04-01 20:05:13,2026-04-02 17:43:02,Večerka,-80.00,0.00,CZK,COMPLETED,518.76",
        "Card Payment,Current,2026-04-04 23:59:05,2026-04-05 06:02:48,Vercel,-277.90,0.00,CZK,COMPLETED,240.86",
        "Topup,Current,2026-04-09 07:52:25,2026-04-09 07:52:26,Apple Pay top-up by *3723,25000.00,0.00,CZK,COMPLETED,25240.86",
      ].join("\n"),
      walletId: "wallet-statement",
      fallbackCurrency: "CZK",
    });

    expect(rows).toEqual([
      {
        walletId: "wallet-statement",
        rowIndex: 1,
        transactionId: null,
        amount: -80,
        currency: "CZK",
        date: "2026-04-02",
        merchant: "Večerka",
        kind: "expense",
      },
      {
        walletId: "wallet-statement",
        rowIndex: 2,
        transactionId: null,
        amount: -277.9,
        currency: "CZK",
        date: "2026-04-05",
        merchant: "Vercel",
        kind: "expense",
      },
      {
        walletId: "wallet-statement",
        rowIndex: 3,
        transactionId: null,
        amount: 25000,
        currency: "CZK",
        date: "2026-04-09",
        merchant: "Apple Pay top-up by *3723",
        kind: "income",
      },
    ]);
  });

  it("parses the provided account statement export fixture when available locally", () => {
    const fixturePath = "/mnt/c/Users/PC/OneDrive/Рабочий стол/account-statement_2026-04-01_2026-04-11_en_54f284.csv";

    if (!existsSync(fixturePath)) {
      return;
    }

    const rows = parseCsvTransactions({
      csvText: readFileSync(fixturePath, "utf8"),
      walletId: "wallet-statement-file",
      fallbackCurrency: "CZK",
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({
      walletId: "wallet-statement-file",
      currency: "CZK",
      merchant: "Večerka",
      amount: -80,
      date: "2026-04-02",
      kind: "expense",
    });
  });
});
