import type { CurrencyCode } from "@/types/currency";

import type { ImportedProviderTransaction } from "@/features/banking/lib/import-rules";

const DATE_HEADERS = ["date", "booking_date", "transaction_date", "value_date", "occurred_at"];
const MERCHANT_HEADERS = ["merchant", "description", "details", "payee", "counterparty", "title", "name"];
const AMOUNT_HEADERS = ["amount", "transaction_amount", "sum", "value"];
const DEBIT_HEADERS = ["debit", "withdrawal", "money_out"];
const CREDIT_HEADERS = ["credit", "deposit", "money_in"];
const CURRENCY_HEADERS = ["currency", "currency_code"];
const EXTERNAL_ID_HEADERS = ["id", "transaction_id", "external_id", "reference", "entry_reference"];

type CsvRecord = Record<string, string>;

function guessDelimiter(headerLine: string) {
  const delimiters = [",", ";", "\t"];
  const scores = delimiters.map((delimiter) => ({
    delimiter,
    parts: headerLine.split(delimiter).length,
  }));

  return scores.sort((left, right) => right.parts - left.parts)[0]?.delimiter ?? ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (isQuoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }

      continue;
    }

    if (character === delimiter && !isQuoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function slugifyHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getFirstValue(record: CsvRecord, headers: string[]) {
  for (const header of headers) {
    const value = record[header];
    if (value != null && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

function normalizeAmountString(raw: string) {
  let value = raw.trim();
  const isNegative = value.startsWith("-") || (value.startsWith("(") && value.endsWith(")"));
  value = value.replace(/[()]/g, "").replace(/[^\d,.\-]/g, "");

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}

function parseSignedAmount(record: CsvRecord) {
  const singleAmount = getFirstValue(record, AMOUNT_HEADERS);

  if (singleAmount) {
    return normalizeAmountString(singleAmount);
  }

  const debit = getFirstValue(record, DEBIT_HEADERS);
  const credit = getFirstValue(record, CREDIT_HEADERS);
  const debitAmount = debit ? normalizeAmountString(debit) : null;
  const creditAmount = credit ? normalizeAmountString(credit) : null;

  if (creditAmount != null && Math.abs(creditAmount) > 0) {
    return Math.abs(creditAmount);
  }

  if (debitAmount != null && Math.abs(debitAmount) > 0) {
    return -Math.abs(debitAmount);
  }

  return null;
}

function normalizeDate(raw: string) {
  const trimmed = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashed = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashed) {
    const [, day, month, year] = slashed;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoTimestamp = new Date(trimmed);
  if (!Number.isNaN(isoTimestamp.getTime())) {
    return isoTimestamp.toISOString().slice(0, 10);
  }

  return null;
}

export function parseCsvTransactions(input: {
  csvText: string;
  walletId: string;
  fallbackCurrency: CurrencyCode;
}) {
  const normalizedText = input.csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!normalizedText) {
    throw new Error("CSV file is empty.");
  }

  const lines = normalizedText.split("\n").filter((line) => line.trim().length > 0);
  const delimiter = guessDelimiter(lines[0] ?? ",");
  const headers = splitCsvLine(lines[0] ?? "", delimiter).map(slugifyHeader);

  if (!headers.length) {
    throw new Error("CSV headers are missing.");
  }

  const parsedRows: ImportedProviderTransaction[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index] ?? "", delimiter);
    const record = headers.reduce<CsvRecord>((accumulator, header, valueIndex) => {
      accumulator[header] = values[valueIndex]?.trim() ?? "";
      return accumulator;
    }, {});

    const merchant = getFirstValue(record, MERCHANT_HEADERS);
    const amount = parseSignedAmount(record);
    const date = getFirstValue(record, DATE_HEADERS);
    const normalizedDate = date ? normalizeDate(date) : null;

    if (!merchant || amount == null || !normalizedDate) {
      continue;
    }

    parsedRows.push({
      walletId: input.walletId,
      rowIndex: index,
      transactionId: getFirstValue(record, EXTERNAL_ID_HEADERS),
      amount,
      currency: (getFirstValue(record, CURRENCY_HEADERS) ?? input.fallbackCurrency).toUpperCase(),
      date: normalizedDate,
      merchant,
    });
  }

  return parsedRows;
}
