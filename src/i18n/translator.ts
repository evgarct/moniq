import { createTranslator } from "next-intl";

import { detectRequestLocale } from "@/i18n/locale";
import { loadMessages } from "@/i18n/messages";

export async function getRequestTranslator(request: Request) {
  const locale = detectRequestLocale(request);
  const messages = await loadMessages(locale);

  return createTranslator({
    locale,
    messages,
  });
}
