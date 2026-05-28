export function sanitizeMoneyInput(value: string) {
  const normalized = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [integerPart = "", ...fractionParts] = normalized.split(".");

  return fractionParts.length > 0 ? `${integerPart}.${fractionParts.join("")}` : integerPart;
}

export function parseMoneyInput(value: string) {
  const sanitized = sanitizeMoneyInput(value);

  if (!sanitized || sanitized === ".") {
    return null;
  }

  const parsed = Number(sanitized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatMoneyInputValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}
