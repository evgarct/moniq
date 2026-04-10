"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BankingConnectPage() {
  const t = useTranslations("banking");
  const [requisitionId, setRequisitionId] = useState("");

  async function handleConnect() {
    const response = await fetch("/api/open-banking/connect-bank", {
      method: "POST",
    });

    const data = (await response.json()) as { link: string; requisition_id: string };
    window.open(data.link, "_blank", "noopener,noreferrer");
    setRequisitionId(data.requisition_id);
  }

  async function handleFinalize() {
    await fetch("/api/open-banking/connect-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requisitionId }),
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("connect.title")}</h1>
      <Button onClick={handleConnect}>{t("connect.button")}</Button>
      <div className="max-w-xl space-y-2">
        <Input value={requisitionId} onChange={(event) => setRequisitionId(event.target.value)} placeholder={t("connect.requisitionPlaceholder")} />
        <Button variant="outline" onClick={handleFinalize}>{t("connect.finalize")}</Button>
      </div>
    </div>
  );
}
