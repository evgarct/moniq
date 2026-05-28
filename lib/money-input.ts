export function sanitizeMoneyInput(value: string) {
  const withDecimalDots = value.replace(/,/g, ".");
  const firstNumberIndex = withDecimalDots.search(/[\d.]/);
  const minusIndex = withDecimalDots.indexOf("-");
  const isNegative = minusIndex !== -1 && (firstNumberIndex === -1 || minusIndex < firstNumberIndex);
  const normalized = withDecimalDots.replace(/[^\d.]/g, "");
  const [integerPart = "", ...fractionParts] = normalized.split(".");
  const sanitized = fractionParts.length > 0 ? `${integerPart}.${fractionParts.join("")}` : integerPart;

  return isNegative ? `-${sanitized}` : sanitized;
}

export function parseMoneyInput(value: string) {
  const sanitized = sanitizeMoneyInput(value);

  if (!sanitized || sanitized === "." || sanitized === "-" || sanitized === "-.") {
    return null;
  }

  const parsed = Number(sanitized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatMoneyInputValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}
