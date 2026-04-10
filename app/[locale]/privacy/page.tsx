import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/page-container";

const DATA_PROTECTION_EMAIL = "isafronovms@gmail.com";

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");

  return (
    <PageContainer className="mx-auto flex max-w-3xl flex-col gap-6 overflow-y-auto py-12">
      <header className="flex flex-col gap-2">
        <h1 className="type-h2">{t("title")}</h1>
        <p className="type-body-14 text-muted-foreground">{t("description")}</p>
      </header>
      <section className="rounded-2xl border border-border bg-card px-6 py-6">
        <p className="type-body-14">{t("body", { email: DATA_PROTECTION_EMAIL })}</p>
      </section>
    </PageContainer>
  );
}
