"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function RecurringChangeScopeOverlay({
  onOnlyThis,
  onAllFollowing,
  onCancel,
}: {
  onOnlyThis: () => void;
  onAllFollowing: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("transactions.form");

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>(
          "[data-recurring-change-scope-primary]",
        )
        ?.focus();
    }, 100);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-change-scope-title"
        aria-describedby="recurring-change-scope-description"
        className="mx-4 mb-6 w-full max-w-sm rounded-[var(--radius-floating)] border border-border/40 bg-card p-5 shadow-lg lg:bg-background"
      >
        <p
          id="recurring-change-scope-title"
          className="type-body-14 mb-1 font-medium text-foreground"
        >
          {t("changeScope.title")}
        </p>
        <p
          id="recurring-change-scope-description"
          className="type-body-14 mb-4 text-muted-foreground"
        >
          {t("changeScope.description")}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            data-recurring-change-scope-primary
            autoFocus
            type="button"
            variant="secondary"
            className="w-full justify-start border-0 shadow-none"
            onClick={onOnlyThis}
          >
            {t("changeScope.onlyThis")}
          </Button>
          <Button
            data-recurring-change-scope-all-following
            type="button"
            variant="secondary"
            className="w-full justify-start border-0 shadow-none"
            onClick={onAllFollowing}
          >
            {t("changeScope.allFollowing")}
          </Button>
          <Button
            data-recurring-change-scope-cancel
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onCancel}
          >
            {t("submit.cancel")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
