import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { ClaudeInboxView } from "@/features/claude-inbox/components/claude-inbox-view";
import { EmptyState } from "@/components/empty-state";
import type { AppLocale } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export default async function ClaudeInboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("claudeInbox");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect({ href: "/login", locale: locale as AppLocale });
  }

  const [batchesResult, snapshotResult] = await Promise.all([
    supabase
      .from("mcp_transaction_batches")
      .select(`
        id,
        status,
        source_description,
        submitted_by,
        created_at,
        reviewed_at,
        mcp_batch_items (
          id,
          title,
          amount,
          occurred_at,
          kind,
          currency,
          note,
          suggested_category_name,
          status,
          resolved_category_id,
          resolved_account_id,
          finance_transaction_id,
          created_at
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("wallets")
      .select("id, name, type, currency")
      .eq("user_id", user.id)
      .order("name"),
  ]);

  const categoriesResult = await supabase
    .from("finance_categories")
    .select("id, name, icon, type, parent_id, user_id, created_at")
    .eq("user_id", user.id)
    .order("name");

  if (batchesResult.error) {
    return (
      <PageContainer>
        <EmptyState
          title={t("error.title")}
          description={t("error.description")}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{t("description")}</p>
      </div>
      <ClaudeInboxView
        batches={batchesResult.data ?? []}
        categories={categoriesResult.data ?? []}
        accounts={(snapshotResult.data ?? []) as Parameters<typeof ClaudeInboxView>[0]["accounts"]}
      />
    </PageContainer>
  );
}
