import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BankingInboxClient } from "@/features/open-banking/components/banking-inbox-client";
import { getTransactions } from "@/features/open-banking/server/repository";

export default async function BankingInboxPage() {
  const t = await getTranslations("banking");
  const drafts = await getTransactions("draft");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("inbox.title")}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/banking/connect">{t("connect.button")}</Link></Button>
          <Button asChild variant="outline"><Link href="/banking/all">{t("all.title")}</Link></Button>
        </div>
      </div>
      <BankingInboxClient initialRows={drafts} />
    </div>
  );
}
