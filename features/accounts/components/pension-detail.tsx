"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormField, FormSheet, FormSheetBody } from "@/components/form-sheet";
import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pensionStatementSchema, type PensionStatementInput } from "@/features/accounts/lib/pension";
import type { Account } from "@/types/finance";

export function PensionDetail({ account, onSave, onBack, initialOpen = false }: { account: Account; onSave: (value: PensionStatementInput) => void; onBack: () => void; initialOpen?: boolean }) {
  const t = useTranslations("accounts.pension");
  const [open, setOpen] = useState(initialOpen);
  const [error, setError] = useState(false);
  const statements = [...(account.pension_state?.statements ?? [])].sort((a,b) => b.as_of.localeCompare(a.as_of));
  const latest = statements[0];
  return <section className="h-full min-h-0 overflow-y-auto bg-card p-4 lg:bg-background lg:p-6">
    <Button variant="ghost" onClick={onBack}>{t("back")}</Button>
    <h2 className="type-h4 mt-4">{account.name}</h2>
    <p className="type-body-12 mt-2 text-muted-foreground">{t("locked")}</p>
    <p className="type-h3 mt-4"><MoneyAmount amount={account.balance} currency={account.currency} /></p>
    <p className="type-body-12 text-muted-foreground">{t("available")}: <MoneyAmount amount={0} currency={account.currency} /></p>
    {latest ? <p className="type-body-12 mt-2 text-muted-foreground">{t("asOf", { date: latest.as_of })}</p> : null}
    <Button className="mt-4" onClick={() => setOpen(true)}>{t("update")}</Button>
    <h3 className="type-h6 mt-6">{t("valuations")}</h3>
    {statements.length ? statements.map((item) => <dl key={item.as_of} className="type-body-14 grid grid-cols-[1fr_auto] gap-2 py-3">
      <dt>{item.as_of}</dt><dd><MoneyAmount amount={item.total_value} currency={account.currency} /></dd>
      {item.invested != null ? <><dt className="text-muted-foreground">{t("invested")}</dt><dd><MoneyAmount amount={item.invested} currency={account.currency} /></dd></> : null}
      {item.provider_result != null ? <><dt className="text-muted-foreground">{t("providerResult")}</dt><dd><MoneyAmount amount={item.provider_result} currency={account.currency} /></dd></> : null}
    </dl>) : <p className="type-body-14 py-3 text-muted-foreground">{t("empty")}</p>}
    <h3 className="type-h6 mt-6">{t("contributions")}</h3>
    {[...(account.pension_state?.entries ?? [])].sort((a,b) => b.occurred_at.localeCompare(a.occurred_at)).map((item) => <div key={item.id} className="type-body-14 flex items-center justify-between gap-4 py-3"><span>{t(item.source)}<span className="type-body-12 block text-muted-foreground">{item.occurred_at}</span></span><MoneyAmount amount={item.amount} currency={account.currency} /></div>)}
    <FormSheet open={open} onOpenChange={setOpen} title={t("update")} submitLabel={t("save")} onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const optional = (key: string) => form.get(key) === "" ? null : Number(form.get(key));
      const parsed = pensionStatementSchema.safeParse({ as_of: form.get("as_of"), total_value: Number(form.get("total_value")), invested: optional("invested"), provider_result: optional("provider_result"), entries: [] });
      if (!parsed.success) { setError(true); return; }
      onSave(parsed.data); setError(false); setOpen(false);
    }}>
      <FormSheetBody>
        <FormField id="pension-as-of" label={t("date")}><Input id="pension-as-of" name="as_of" type="date" required defaultValue={new Date().toISOString().slice(0,10)} /></FormField>
        <FormField id="pension-value" label={t("value")}><Input id="pension-value" name="total_value" type="number" min="0" step="0.01" required defaultValue={account.balance} /></FormField>
        <FormField id="pension-invested" label={t("invested")}><Input id="pension-invested" name="invested" type="number" min="0" step="0.01" defaultValue={latest?.invested ?? ""} /></FormField>
        <FormField id="pension-result" label={t("providerResult")}><Input id="pension-result" name="provider_result" type="number" step="0.01" defaultValue={latest?.provider_result ?? ""} /></FormField>
        {error ? <p role="alert" className="type-body-14 text-destructive">{t("invalid")}</p> : null}
      </FormSheetBody>
    </FormSheet>
  </section>;
}
