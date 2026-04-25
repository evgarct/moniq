"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function RescheduleConfirmOverlay({
  onOnlyThis,
  onAllFollowing,
  onCancel,
}: {
  onOnlyThis: () => void;
  onAllFollowing: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("transactions.form");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 mb-6 w-full max-w-sm rounded-2xl border border-border/40 bg-background p-5 shadow-xl">
        <p className="mb-1 text-[15px] font-medium text-foreground">{t("reschedule.title")}</p>
        <p className="mb-4 text-sm text-muted-foreground">{t("reschedule.description")}</p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start border-0 shadow-none"
            onClick={onOnlyThis}
          >
            {t("reschedule.onlyThis")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start border-0 shadow-none"
            onClick={onAllFollowing}
          >
            {t("reschedule.allFollowing")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onCancel}
          >
            {t("submit.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
