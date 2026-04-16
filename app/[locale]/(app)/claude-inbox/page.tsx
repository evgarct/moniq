import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default async function ClaudeInboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return redirect({ href: "/inbox", locale: locale as AppLocale });
}
