export function normalizeMerchant(input: string) {
  const withoutDigits = input.replace(/\d+/g, " ");
  const cleaned = withoutDigits.replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "Unknown";
  }

  const [primary] = cleaned.split(" ");
  const normalized = primary.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
