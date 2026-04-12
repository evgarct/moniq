import { read, utils } from "xlsx";

import type { CurrencyCode } from "@/types/currency";
import type { ImportColumnMapping, ImportColumnOption, ImportFilePreview, ImportPreviewRow } from "@/types/imports";

import type { ImportedProviderTransaction } from "@/features/banking/lib/import-rules";

const DATE_HEADERS = ["date", "completed_date", "booking_date", "posting_date", "transaction_date", "value_date", "started_date", "occurred_at"];
const DESCRIPTION_HEADERS = ["description", "merchant", "details", "payee", "counterparty", "title", "name", "note", "transaction_type"];
const AMOUNT_HEADERS = ["amount", "transaction_amount", "posting_amount", "sum", "value", "original_amount"];
const DEBIT_HEADERS = ["debit", "withdrawal", "money_out"];
const CREDIT_HEADERS = ["credit", "deposit", "money_in"];
const CURRENCY_HEADERS = ["currency", "currency_code", "posting_currency", "original_currency"];
const TYPE_HEADERS = ["type", "transaction_type", "operation_type", "entry_type"];
const EXTERNAL_ID_HEADERS = ["id", "transaction_id", "external_id", "reference", "entry_reference"];

type FlatRow = {
  rowIndex: number;
  values: string[];
};

type FlatTable = {
  columns: ImportColumnOption[];
  rows: FlatRow[];
  signature: string;
};

const TRANSFER_PATTERN = /\b(transfer|internal transfer|bank transfer|to .*account|from .*account|between accounts)\b/i;
const INCOME_PATTERN = /\b(salary|payroll|refund|cashback|interest|bonus|topup|top-up|deposit)\b/i;

function slugifyHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCellValue(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function findColumnKey(columns: ImportColumnOption[], candidates: string[]) {
  for (const candidate of candidates) {
    const matched = columns.find((column) => column.key === candidate);

    if (matched) {
      return matched.key;
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

function normalizeDate(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dotted = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashed = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashed) {
    const [, day, month, year] = slashed;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoLike = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoLike) {
    const [, year, month, day] = isoLike;
    return `${year}-${month}-${day}`;
  }

  const isoTimestamp = new Date(trimmed);
  if (!Number.isNaN(isoTimestamp.getTime())) {
    return isoTimestamp.toISOString().slice(0, 10);
  }

  return null;
}

function inferKind(typeValue: string | null, amount: number, description: string) {
  const haystack = [typeValue, description].filter(Boolean).join(" ");

  if (TRANSFER_PATTERN.test(haystack)) {
    return "transfer" as const;
  }

  if (typeValue && INCOME_PATTERN.test(typeValue)) {
    return "income" as const;
  }

  if (amount >= 0) {
    return "income" as const;
  }

  return "expense" as const;
}

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

function buildFlatTableFromMatrix(matrix: string[][]) {
  const nonEmptyRows = matrix.filter((row) => row.some((cell) => cell.length > 0));

  if (!nonEmptyRows.length) {
    throw new Error("CSV file is empty.");
  }

  const headerRow = nonEmptyRows[0];
  const columns = headerRow.map((label, index) => ({
    index,
    label,
    key: slugifyHeader(label || `column_${index + 1}`),
  }));

  if (!columns.length) {
    throw new Error("CSV headers are missing.");
  }

  const rows = nonEmptyRows.slice(1).map((values, index) => ({
    rowIndex: index + 1,
    values: columns.map((_, columnIndex) => values[columnIndex] ?? ""),
  }));

  return {
    columns,
    rows,
    signature: columns.map((column) => column.key).join("|"),
  } satisfies FlatTable;
}

function readDelimitedTableFromBuffer(fileBuffer: Uint8Array) {
  const text = new TextDecoder("utf-8").decode(fileBuffer).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!text) {
    throw new Error("CSV file is empty.");
  }

  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const delimiter = guessDelimiter(lines[0] ?? ",");
  const matrix = lines.map((line) => splitCsvLine(line, delimiter));

  return buildFlatTableFromMatrix(matrix);
}

function readTableFromBuffer(input: { fileName: string; fileBuffer: Uint8Array }) {
  const lowerFileName = input.fileName.toLowerCase();

  if (lowerFileName.endsWith(".csv") || lowerFileName.endsWith(".tsv") || lowerFileName.endsWith(".txt")) {
    return readDelimitedTableFromBuffer(input.fileBuffer);
  }

  const workbook = read(input.fileBuffer, {
    type: "array",
    cellDates: false,
    raw: false,
    dense: true,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("CSV file is empty.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const matrix = utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const normalizedRows = matrix
    .map((row) => row.map((cell) => normalizeCellValue(cell)))
    .filter((row) => row.some((cell) => cell.length > 0));

  return buildFlatTableFromMatrix(normalizedRows);
}

export function suggestColumnMapping(columns: ImportColumnOption[]): ImportColumnMapping {
  return {
    date: findColumnKey(columns, DATE_HEADERS),
    amount: findColumnKey(columns, AMOUNT_HEADERS),
    debit: findColumnKey(columns, DEBIT_HEADERS),
    credit: findColumnKey(columns, CREDIT_HEADERS),
    description: findColumnKey(columns, DESCRIPTION_HEADERS),
    currency: findColumnKey(columns, CURRENCY_HEADERS),
    type: findColumnKey(columns, TYPE_HEADERS),
    externalId: findColumnKey(columns, EXTERNAL_ID_HEADERS),
  };
}

export function canImportWithMapping(mapping: ImportColumnMapping) {
  return Boolean(mapping.date && mapping.description && (mapping.amount || mapping.debit || mapping.credit));
}

function getCellValue(row: FlatRow, columnsByKey: Map<string, ImportColumnOption>, key: string | null) {
  if (!key) {
    return null;
  }

  const column = columnsByKey.get(key);
  if (!column) {
    return null;
  }

  const value = row.values[column.index] ?? "";
  return value.trim() ? value.trim() : null;
}

function parseSignedAmount(row: FlatRow, columnsByKey: Map<string, ImportColumnOption>, mapping: ImportColumnMapping) {
  const singleAmount = getCellValue(row, columnsByKey, mapping.amount);

  if (singleAmount) {
    return normalizeAmountString(singleAmount);
  }

  const debit = getCellValue(row, columnsByKey, mapping.debit);
  const credit = getCellValue(row, columnsByKey, mapping.credit);
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

export function buildImportFilePreview(input: {
  fileName: string;
  fileBuffer: Uint8Array;
}): ImportFilePreview {
  const table = readTableFromBuffer(input);
  const suggestedMapping = suggestColumnMapping(table.columns);

  return {
    fileName: input.fileName,
    signature: table.signature,
    columns: table.columns,
    rows: table.rows.slice(0, 8).map((row) => ({
      rowIndex: row.rowIndex,
      values: row.values,
    })) satisfies ImportPreviewRow[],
    suggestedMapping,
    canImport: canImportWithMapping(suggestedMapping),
  };
}

export function parseMappedTransactions(input: {
  fileName: string;
  fileBuffer: Uint8Array;
  walletId: string;
  fallbackCurrency: CurrencyCode;
  mapping: ImportColumnMapping;
}) {
  const table = readTableFromBuffer(input);

  if (!canImportWithMapping(input.mapping)) {
    throw new Error("CSV file did not contain recognizable transaction rows.");
  }

  const columnsByKey = new Map(table.columns.map((column) => [column.key, column]));
  const parsedRows: ImportedProviderTransaction[] = [];

  for (const row of table.rows) {
    const description = getCellValue(row, columnsByKey, input.mapping.description);
    const dateRaw = getCellValue(row, columnsByKey, input.mapping.date);
    const amount = parseSignedAmount(row, columnsByKey, input.mapping);
    const normalizedDate = dateRaw ? normalizeDate(dateRaw) : null;

    if (!description || amount == null || !normalizedDate) {
      continue;
    }

    const typeValue = getCellValue(row, columnsByKey, input.mapping.type);
    parsedRows.push({
      walletId: input.walletId,
      rowIndex: row.rowIndex,
      transactionId: getCellValue(row, columnsByKey, input.mapping.externalId),
      amount,
      currency: (getCellValue(row, columnsByKey, input.mapping.currency) ?? input.fallbackCurrency).toUpperCase(),
      date: normalizedDate,
      merchant: description,
      kind: inferKind(typeValue, amount, description),
    });
  }

  return parsedRows;
}

export function parseCsvTransactions(input: {
  csvText: string;
  walletId: string;
  fallbackCurrency: CurrencyCode;
}) {
  const fileBuffer = new TextEncoder().encode(input.csvText);
  const preview = buildImportFilePreview({
    fileName: "import.csv",
    fileBuffer,
  });

  return parseMappedTransactions({
    fileName: "import.csv",
    fileBuffer,
    walletId: input.walletId,
    fallbackCurrency: input.fallbackCurrency,
    mapping: preview.suggestedMapping,
  });
}
