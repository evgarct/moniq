import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { CurrencySettings } from "@/features/settings/components/currency-settings";
import { McpSettings } from "@/features/settings/components/mcp-settings";
import { getUserPreferencesWithDefault } from "@/features/finance/server/repository";
import type { AppLocale } from "@/i18n/routing";
import type { CurrencyCode } from "@/types/currency";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("settings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect({ href: "/login", locale: locale as AppLocale });
  }

  const { data: keys } = await supabase
    .from("mcp_api_keys")
    .select("id, name, key_prefix, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const { data: wallets } = await supabase
    .from("wallets")
    .select("currency")
    .eq("user_id", user.id);
  const walletCurrencies = ((wallets ?? []) as { currency: CurrencyCode }[]).map((wallet) => wallet.currency);
  const preferences = await getUserPreferencesWithDefault(
    user.id,
    walletCurrencies.map((currency) => ({ currency })),
  );

  return (
    <PageContainer className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      </div>
      <div className="flex flex-col gap-8">
        <CurrencySettings
          initialDefaultCurrency={preferences.default_currency}
          initialDefaultCurrencySource={preferences.default_currency_source}
          walletCurrencies={walletCurrencies}
        />
        <McpSettings initialKeys={keys ?? []} />
      </div>
    </PageContainer>
  );
}
