import { getTranslations } from "next-intl/server";

import { AllTransactionsClient } from "@/features/open-banking/components/all-transactions-client";
import { getTransactions } from "@/features/open-banking/server/repository";

export default async function AllBankingTransactionsPage() {
  const t = await getTranslations("banking");
  const confirmed = await getTransactions("confirmed");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("all.title")}</h1>
      <AllTransactionsClient initialRows={confirmed} />
    </div>
  );
}
