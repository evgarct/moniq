import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/reports/projected-balance", locale: locale as AppLocale });
}
