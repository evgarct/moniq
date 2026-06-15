"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { getPositionMarketValue, getPositionUnits } from "@/features/investments/lib/positions";
import type { InvestmentPosition, Transaction } from "@/types/finance";

export function InvestmentDetail({
  position,
  transactions,
  onClose,
  onAddPurchase,
}: {
  position: InvestmentPosition;
  transactions: Transaction[];
  onClose: () => void;
  onAddPurchase: () => void;
}) {
  const t = useTranslations("investments");
  const purchases = transactions.filter((transaction) => transaction.investment_instrument_id === position.instrument_id);
  const units = getPositionUnits(position, transactions);
  const value = getPositionMarketValue(position, transactions);
  return (
    <section className="hidden min-h-0 flex-col overflow-y-auto bg-background lg:flex">
      <header className="flex items-start justify-between gap-4 px-7 pb-5 pt-8">
        <div>
          <h2 className="type-h1">{position.instrument.name}</h2>
          <p className="mt-1 type-body-14 text-muted-foreground">
            {position.instrument.ticker} · {position.instrument.exchange} · {position.instrument.isin}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onAddPurchase} aria-label={t("actions.addPurchase")}><Plus /></Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("actions.close")}><X /></Button>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-6 border-y border-border/40 px-7 py-5">
        <div><p className="type-body-12 text-muted-foreground">{t("labels.units")}</p><p className="type-h3 tabular-nums">{units}</p></div>
        <div>
          <p className="type-body-12 text-muted-foreground">{t("labels.marketValue")}</p>
          {value == null ? <p className="type-body-14 text-muted-foreground">{t("quoteUnavailable")}</p> : (
            <MoneyAmount amount={value} currency={position.latest_quote!.currency} display="absolute" className="type-h3" />
          )}
          {position.latest_quote ? <p className="mt-1 type-body-12 text-muted-foreground">{t("quoteDate", { date: position.latest_quote.market_date })}</p> : null}
        </div>
      </div>
      <div className="px-7 py-5">
        <h3 className="mb-3 type-h6">{t("purchases")}</h3>
        <TransactionList transactions={purchases} emptyMessage={t("noPurchases")} groupByDate />
      </div>
    </section>
  );
}
