import type { AppLocale } from "@/i18n/routing";

import enMessages from "@/messages/en.json";

export type AppMessages = typeof enMessages;

export const messageLoaders: Record<AppLocale, () => Promise<AppMessages>> = {
  en: () => import("../../messages/en.json").then((module) => module.default),
  ru: () => import("../../messages/ru.json").then((module) => module.default as AppMessages),
};

export async function loadMessages(locale: AppLocale): Promise<AppMessages> {
  return messageLoaders[locale]();
}
