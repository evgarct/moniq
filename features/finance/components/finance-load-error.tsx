"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Error state for a failed finance snapshot load, with a retry action instead of a dead end. */
export function FinanceLoadError({
  title,
  fallbackDescription,
  error,
  onRetry,
}: {
  title: string;
  fallbackDescription: string;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations("common.actions");

  return (
    <EmptyState
      title={title}
      description={error instanceof Error ? error.message : fallbackDescription}
      action={<Button variant="outline" onClick={onRetry}>{t("retry")}</Button>}
    />
  );
}
