"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { BalanceRegisterHeader } from "@/features/accounts/components/balance-register-panel";
import { getPositionMarketValue, getPositionUnits } from "@/features/investments/lib/positions";
import type { InvestmentPosition, Transaction } from "@/types/finance";
import { cn } from "@/lib/utils";

export function InvestmentDetail({
  position,
  transactions,
  onClose,
  onAddPurchase,
  mobile = false,
}: {
  position: InvestmentPosition;
  transactions: Transaction[];
  onClose: () => void;
  onAddPurchase: () => void;
  mobile?: boolean;
}) {
  const t = useTranslations("investments");
  const [scrolled, setScrolled] = useState(false);
  const purchases = transactions.filter((transaction) => transaction.investment_instrument_id === position.instrument_id);
  const units = getPositionUnits(position, transactions);
  const value = getPositionMarketValue(position, transactions);
  const description = `${position.instrument.ticker} · ${position.instrument.exchange} · ${position.instrument.isin}`;

  return (
    <section
      className={cn("min-h-0 flex-col overflow-y-auto bg-background", mobile ? "flex h-full" : "hidden lg:flex")}
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
    >
      <BalanceRegisterHeader
        title={position.instrument.name}
        description={description}
        onAddTransaction={onAddPurchase}
        onBack={mobile ? onClose : undefined}
        onClearSelection={!mobile ? onClose : undefined}
        showClearSelection={!mobile}
        scrolled={scrolled}
      />
      <div className="grid grid-cols-2 gap-4 border-y border-border/40 px-4 py-5 lg:gap-6 lg:px-7">
        <div><p className="type-body-12 text-muted-foreground">{t("labels.units")}</p><p className="type-h3 tabular-nums">{units}</p></div>
        <div>
          <p className="type-body-12 text-muted-foreground">{t("labels.marketValue")}</p>
          {value == null ? <p className="type-body-14 text-muted-foreground">{t("quoteUnavailable")}</p> : (
            <MoneyAmount amount={value} currency={position.latest_quote!.currency} display="absolute" className="type-h3" />
          )}
          {position.latest_quote ? <p className="mt-1 type-body-12 text-muted-foreground">{t("quoteDate", { date: position.latest_quote.market_date })}</p> : null}
        </div>
      </div>
      <div className="px-4 py-5 lg:px-7">
        <h3 className="mb-3 type-h6">{t("purchases")}</h3>
        <TransactionList transactions={purchases} emptyMessage={t("noPurchases")} groupByDate />
      </div>
    </section>
  );
}
