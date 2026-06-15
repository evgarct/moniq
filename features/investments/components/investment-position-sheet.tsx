"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { FormField, FormSheet, FormSheetBody } from "@/components/form-sheet";
import { Input } from "@/components/ui/input";
import type { InvestmentInstrumentCandidate } from "@/types/finance";

export function InvestmentPositionSheet({
  open,
  onOpenChange,
  onSubmit,
  initialInstruments = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (instrument: InvestmentInstrumentCandidate, openingUnits: number) => void;
  initialInstruments?: InvestmentInstrumentCandidate[];
}) {
  const t = useTranslations("investments.form");
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<InvestmentInstrumentCandidate[]>([]);
  const [selected, setSelected] = useState<InvestmentInstrumentCandidate | null>(null);
  const [units, setUnits] = useState("");

  useEffect(() => {
    if (!open || query.trim().length < 2) return;

    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/investments/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (response.ok) setRemoteResults(await response.json());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  const results = query.trim().length < 2 ? initialInstruments : remoteResults;

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(units.replace(",", "."));
        if (selected && Number.isFinite(parsed) && parsed >= 0) onSubmit(selected, parsed);
      }}
    >
      <FormSheetBody>
        <FormField id="investment-search" label={t("instrument")}>
          <Input id="investment-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
        </FormField>
        <div className="flex flex-col">
          {results.map((instrument) => (
            <button
              type="button"
              key={`${instrument.provider}:${instrument.provider_symbol}`}
              className="flex min-h-12 items-center justify-between px-2 text-left hover:bg-secondary/50"
              onClick={() => setSelected(instrument)}
            >
              <span>
                <span className="block type-body-14">{instrument.name}</span>
                <span className="type-body-12 text-muted-foreground">
                  {instrument.ticker} {"\u00b7"} {instrument.exchange} {"\u00b7"} {instrument.quote_currency}
                </span>
              </span>
              {selected?.provider_symbol === instrument.provider_symbol ? <span className="type-body-12">{t("selected")}</span> : null}
            </button>
          ))}
        </div>
        <FormField id="investment-units" label={t("openingUnits")}>
          <Input id="investment-units" inputMode="decimal" value={units} onChange={(event) => setUnits(event.target.value)} />
        </FormField>
      </FormSheetBody>
    </FormSheet>
  );
}
