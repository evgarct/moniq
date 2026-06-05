"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CircleDollarSign } from "lucide-react";

import { Surface, SurfaceDescription, SurfaceEyebrow, SurfaceHeader } from "@/components/surface";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { financeSnapshotQueryKey, updateUserPreferencesRequest } from "@/features/finance/lib/finance-api";
import { SUPPORTED_CURRENCIES } from "@/types/currency";
import type { CurrencyCode } from "@/types/currency";
import type { DefaultCurrencySource, FinanceSnapshot } from "@/types/finance";

type CurrencySettingsProps = {
  initialDefaultCurrency: CurrencyCode;
  initialDefaultCurrencySource: DefaultCurrencySource;
  walletCurrencies: CurrencyCode[];
};

function getCurrencyLabel(currency: CurrencyCode, displayNames: Intl.DisplayNames | null) {
  return `${currency} · ${displayNames?.of(currency) ?? currency}`;
}

export function CurrencySettings({
  initialDefaultCurrency,
  initialDefaultCurrencySource,
  walletCurrencies,
}: CurrencySettingsProps) {
  const t = useTranslations("settings.currency");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(initialDefaultCurrency);
  const [savedCurrency, setSavedCurrency] = useState<CurrencyCode>(initialDefaultCurrency);
  const [source, setSource] = useState<DefaultCurrencySource>(initialDefaultCurrencySource);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const walletCurrencyOptions = useMemo(
    () => Array.from(new Set(walletCurrencies)),
    [walletCurrencies],
  );
  const currencyDisplayNames = useMemo(() => {
    if (typeof Intl.DisplayNames === "undefined") {
      return null;
    }

    return new Intl.DisplayNames([locale], { type: "currency" });
  }, [locale]);
  const secondaryCurrencyOptions = useMemo(
    () => SUPPORTED_CURRENCIES.map((currency) => currency.code).filter((code) => !walletCurrencyOptions.includes(code)),
    [walletCurrencyOptions],
  );
  const isDirty = defaultCurrency !== savedCurrency;

  async function saveDefaultCurrency() {
    setStatus("saving");
    setError(null);

    try {
      const snapshot = await updateUserPreferencesRequest({ default_currency: defaultCurrency });
      queryClient.setQueryData<FinanceSnapshot>(financeSnapshotQueryKey, snapshot);
      setSavedCurrency(defaultCurrency);
      setSource("saved");
      setStatus("saved");
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : t("saveError"));
    }
  }

  return (
    <Surface tone="panel" padding="lg">
      <div className="flex items-start gap-3">
        <CircleDollarSign className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <SurfaceHeader className="mb-5 px-0">
            <div className="flex flex-col gap-1">
              <SurfaceEyebrow>{t("eyebrow")}</SurfaceEyebrow>
              <h2 className="type-h5 text-foreground">{t("title")}</h2>
              <SurfaceDescription>{t("description")}</SurfaceDescription>
            </div>
          </SurfaceHeader>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="default-currency" className="type-body-12 font-medium text-foreground">
                {t("fieldLabel")}
              </label>
              <Select value={defaultCurrency} onValueChange={(value) => setDefaultCurrency(value as CurrencyCode)}>
                <SelectTrigger id="default-currency" className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {walletCurrencyOptions.length ? (
                    <SelectGroup>
                      <SelectLabel>{t("walletCurrencies")}</SelectLabel>
                      {walletCurrencyOptions.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {getCurrencyLabel(currency, currencyDisplayNames)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {walletCurrencyOptions.length ? <SelectSeparator /> : null}
                  <SelectGroup>
                    <SelectLabel>{t("otherCurrencies")}</SelectLabel>
                    {secondaryCurrencyOptions.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {getCurrencyLabel(currency, currencyDisplayNames)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="type-body-12 text-muted-foreground">{t(`source.${source}`)}</p>
              {error ? <p className="type-body-12 text-destructive">{error}</p> : null}
              {status === "saved" && !isDirty ? (
                <p className="type-body-12 text-muted-foreground">{t("saved")}</p>
              ) : null}
            </div>

            <Button type="button" onClick={saveDefaultCurrency} disabled={!isDirty || status === "saving"}>
              {status === "saving" ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </div>
    </Surface>
  );
}
