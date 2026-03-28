export const SUPPORTED_CURRENCIES = [
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE", primary: true },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", locale: "cs-CZ", primary: true },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", locale: "ru-RU", primary: true },
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", primary: false },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB", primary: false },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH", primary: false },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", locale: "pl-PL", primary: false },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", locale: "uk-UA", primary: false },
  { code: "AED", name: "UAE Dirham", symbol: "AED", locale: "en-AE", primary: false },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", locale: "tr-TR", primary: false },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP", primary: false },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", locale: "en-CA", primary: false },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

