"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectedBalanceSeriesConfig } from "@/features/reports/lib/projected-balance";
import type { Account } from "@/types/finance";

const MAX_SERIES = 5;

function createSeries(index: number, accountId: string | undefined) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `series-${Date.now()}-${index}`,
    name: "",
    accountIds: accountId ? [accountId] : [],
  };
}

export function ProjectedBalanceSeriesEditor({
  open,
  onOpenChange,
  accounts,
  series,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  series: ProjectedBalanceSeriesConfig[];
  onSave: (series: ProjectedBalanceSeriesConfig[]) => void;
}) {
  const t = useTranslations("reports.projectedBalance.editor");
  const commonT = useTranslations("common.actions");
  const [draft, setDraft] = useState(series);

  const validDraft = draft
    .map((item, index) => ({
      ...item,
      name: item.name.trim() || t("defaultSeriesName", { number: String(index + 1) }),
      accountIds: Array.from(new Set(item.accountIds)),
    }))
    .filter((item) => item.accountIds.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="responsive" className="gap-0 overflow-hidden" showCloseButton>
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <FieldGroup>
            {draft.map((item, index) => (
              <FieldSet
                key={item.id}
                className="gap-4 border-b border-border/60 pb-5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <FieldLegend>{t("seriesLabel", { number: String(index + 1) })}</FieldLegend>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={index === 0}
                            aria-label={t("moveUp")}
                            onClick={() => {
                              setDraft((current) => {
                                const next = [...current];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                return next;
                              });
                            }}
                          />
                        }
                      >
                        <ArrowUp />
                      </TooltipTrigger>
                      <TooltipContent>{t("moveUp")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={index === draft.length - 1}
                            aria-label={t("moveDown")}
                            onClick={() => {
                              setDraft((current) => {
                                const next = [...current];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                return next;
                              });
                            }}
                          />
                        }
                      >
                        <ArrowDown />
                      </TooltipTrigger>
                      <TooltipContent>{t("moveDown")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={draft.length === 1}
                            aria-label={t("remove")}
                            onClick={() => {
                              setDraft((current) => current.filter((series) => series.id !== item.id));
                            }}
                          />
                        }
                      >
                        <Trash2 />
                      </TooltipTrigger>
                      <TooltipContent>{t("remove")}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <Field>
                  <FieldLabel htmlFor={`series-name-${item.id}`}>{t("name")}</FieldLabel>
                  <Input
                    id={`series-name-${item.id}`}
                    value={item.name}
                    placeholder={t("namePlaceholder")}
                    maxLength={60}
                    onChange={(event) => {
                      const name = event.target.value;
                      setDraft((current) =>
                        current.map((series) =>
                          series.id === item.id ? { ...series, name } : series,
                        ),
                      );
                    }}
                  />
                </Field>

                <FieldSet className="gap-3">
                  <FieldLegend variant="label">{t("accounts")}</FieldLegend>
                  <div data-slot="checkbox-group" className="flex flex-col gap-1">
                    {accounts.map((account) => {
                      const checkboxId = `series-${item.id}-account-${account.id}`;
                      const checked = item.accountIds.includes(account.id);

                      return (
                        <Field key={account.id} orientation="horizontal">
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              setDraft((current) =>
                                current.map((series) => {
                                  if (series.id !== item.id) return series;
                                  return {
                                    ...series,
                                    accountIds: nextChecked
                                      ? [...series.accountIds, account.id]
                                      : series.accountIds.filter((accountId) => accountId !== account.id),
                                  };
                                }),
                              );
                            }}
                          />
                          <FieldLabel htmlFor={checkboxId}>
                            <FieldContent>
                              <FieldTitle>{account.name}</FieldTitle>
                              <p className="type-body-12 text-muted-foreground">{account.currency}</p>
                            </FieldContent>
                          </FieldLabel>
                        </Field>
                      );
                    })}
                  </div>
                </FieldSet>
              </FieldSet>
            ))}

            {draft.length < MAX_SERIES ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft((current) => [...current, createSeries(current.length + 1, accounts[0]?.id)]);
                }}
              >
                <Plus data-icon="inline-start" />
                {t("addSeries")}
              </Button>
            ) : null}
          </FieldGroup>
        </div>

        <SheetFooter className="border-t border-border/60">
          <Button
            type="button"
            disabled={!validDraft.length}
            onClick={() => {
              onSave(validDraft);
              onOpenChange(false);
            }}
          >
            {commonT("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
