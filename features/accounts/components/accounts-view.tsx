"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Info, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountList } from "@/components/account-list";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { BalanceRegisterHeader, BalanceRegisterPanel } from "@/features/accounts/components/balance-register-panel";
import { useFinanceActions } from "@/features/finance/hooks/use-finance-actions";
import { GoalFormSheet } from "@/features/goals/components/goal-form-sheet";
import { InvestmentDetail } from "@/features/investments/components/investment-detail";
import { InvestmentList } from "@/features/investments/components/investment-list";
import { InvestmentPositionSheet } from "@/features/investments/components/investment-position-sheet";
import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { getTransactionsForAccount } from "@/lib/finance-selectors";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Account, Category, InvestmentPosition, Transaction, WalletAllocation } from "@/types/finance";

export function AccountsView({
  accounts,
  categories,
  transactions,
  allocations,
  investmentPositions,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  allocations: WalletAllocation[];
  investmentPositions: InvestmentPosition[];
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  const copy = t as unknown as (key: string) => string;
  const financeActions = useFinanceActions();
  const transactionActions = useTransactionActions();
  const defaultRegisterDateFrom = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const defaultRegisterDateTo = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [walletSheetMode, setWalletSheetMode] = useState<"add" | "edit">("add");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [draftWalletType, setDraftWalletType] = useState<Account["type"]>("cash");
  const [walletsEditMode, setWalletsEditMode] = useState(false);
  const [showMinorUnits, setShowMinorUnits] = useState(false);
  const [mobileRegisterOpen, setMobileRegisterOpen] = useState(false);
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);
  const [transactionSheetMode, setTransactionSheetMode] = useState<"add" | "edit-transaction">("add");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [registerDateFrom, setRegisterDateFrom] = useState(defaultRegisterDateFrom);
  const [registerDateTo, setRegisterDateTo] = useState(defaultRegisterDateTo);
  const [leftPanelScrolled, setLeftPanelScrolled] = useState(false);
  const [mobileRegisterScrolled, setMobileRegisterScrolled] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [goalSheetMode, setGoalSheetMode] = useState<"add" | "edit">("add");
  const [editingAllocation, setEditingAllocation] = useState<WalletAllocation | null>(null);
  const [goalWalletId, setGoalWalletId] = useState<string | null>(null);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const [investmentSheetOpen, setInvestmentSheetOpen] = useState(false);
  const [purchaseInstrumentId, setPurchaseInstrumentId] = useState<string | null>(null);

  function deleteGoalOptimistic(allocationId: string) {
    financeActions.deleteAllocation(allocationId, {
      onError: () => setActionError(t("messages.saveWalletError")),
    });
  }

  const selectedAccount = selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) ?? null : null;
  const selectedInvestment = selectedInvestmentId
    ? investmentPositions.find((position) => position.id === selectedInvestmentId) ?? null
    : null;
  const investmentInstruments = useMemo(
    () => investmentPositions.map((position) => position.instrument),
    [investmentPositions],
  );
  const settledTransactions = useMemo(
    () =>
      [...transactions]
        .filter((transaction) => isSettledTransactionStatus(transaction.status))
        .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at)),
    [transactions],
  );
  const register = selectedAccount
    ? getTransactionsForAccount(settledTransactions, selectedAccount.id)
    : settledTransactions;
  const filteredRegister = register.filter((transaction) => {
    const occurredOn = transaction.occurred_at.slice(0, 10);
    if (registerDateFrom && occurredOn < registerDateFrom) return false;
    if (registerDateTo && occurredOn > registerDateTo) return false;
    return true;
  });
  const pending = false;
  const hasAccounts = accounts.length > 0;
  const registerTitle = selectedAccount ? selectedAccount.name : t("view.activity");
  const toolbarButtonClassName =
    "bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground active:bg-secondary";

  const isDesktopViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  function closeMobileRegister() {
    setMobileRegisterOpen(false);
    setSelectedAccountId(null);
  }

  function openTransactionEditor(transaction: Transaction) {
    setActionError(null);
    setTransactionSheetMode("edit-transaction");
    setEditingTransaction(transaction);
    setPurchaseInstrumentId(null);
    setTransactionSheetOpen(true);
  }

  function openAddTransaction() {
    setActionError(null);
    setTransactionSheetMode("add");
    setEditingTransaction(null);
    setPurchaseInstrumentId(null);
    setTransactionSheetOpen(true);
  }

  function openAddWallet(type: Account["type"] = "cash") {
    setActionError(null);
    setWalletSheetMode("add");
    setEditingAccount(null);
    setDraftWalletType(type);
    setWalletSheetOpen(true);
  }

  function openEditWallet(account: Account) {
    setActionError(null);
    setWalletSheetMode("edit");
    setEditingAccount(account);
    setDraftWalletType(account.type);
    setWalletSheetOpen(true);
  }

  function handleSaveWallet(values: {
    name: string;
    type: Account["type"];
    balance: number;
    credit_limit: number | null;
    currency: CurrencyCode;
    debt_kind?: Account["debt_kind"];
  }) {
    if (walletSheetMode === "edit" && editingAccount) {
      setSelectedAccountId(editingAccount.id);
    }
    financeActions.saveWallet(walletSheetMode, values, editingAccount?.id, {
      onError: (error) =>
        setActionError(error instanceof Error ? error.message : t("messages.saveWalletError")),
    });
    setActionError(null);
  }

  function handleDeleteWallet(account: Account) {
    if (!window.confirm(t("messages.deleteWalletConfirm", { name: account.name }))) {
      return;
    }

    financeActions.deleteWallet(account.id, {
      onError: (error) =>
        setActionError(error instanceof Error ? error.message : t("messages.deleteWalletError")),
    });
    setSelectedAccountId((current) => (current === account.id ? null : current));
    setActionError(null);
  }

  function handleAdjustBalance(account: Account, newBalance: number) {
    financeActions.adjustWalletBalance(account.id, newBalance, null, {
      onError: (error) =>
        setActionError(error instanceof Error ? error.message : t("messages.saveWalletError")),
    });
    setActionError(null);
  }

  return (
    <>
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden border-b border-border/40 bg-card lg:border-r lg:border-b-0 lg:border-r-border/25">
          <div
            className={cn(
              "border-b border-transparent bg-card/96 backdrop-blur transition-[background-color,border-color] supports-[backdrop-filter]:bg-card/88",
              leftPanelScrolled && "border-border/45",
            )}
          >
            <div className="flex flex-col gap-3 px-3 pt-4 pb-3 sm:gap-4 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
              <div className="flex items-start justify-between gap-2 px-1.5 sm:gap-3 sm:px-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
                    {t("view.title")}
                  </h1>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground active:bg-secondary"
                          aria-label={walletsEditMode ? copy("view.editModeDescription") : t("view.description")}
                        />
                      }
                    >
                      <Info className="size-4 translate-y-[2px]" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72 text-balance">
                      {walletsEditMode ? copy("view.editModeDescription") : t("view.description")}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div
                  className="flex shrink-0 items-center gap-1 sm:gap-2"
                  role="toolbar"
                  aria-label={t("view.title")}
                >
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={cn(
                            toolbarButtonClassName,
                            showMinorUnits && "bg-secondary text-foreground",
                          )}
                          aria-label={showMinorUnits ? copy("view.hideMinorUnits") : copy("view.showMinorUnits")}
                          aria-pressed={showMinorUnits}
                        />
                      }
                      onClick={() => setShowMinorUnits((current) => !current)}
                    >
                      {showMinorUnits ? <Eye /> : <EyeOff />}
                    </TooltipTrigger>
                    <TooltipContent>
                      {showMinorUnits ? copy("view.hideMinorUnits") : copy("view.showMinorUnits")}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={cn(
                            toolbarButtonClassName,
                            walletsEditMode && "bg-secondary text-foreground",
                          )}
                          aria-label={walletsEditMode ? t("view.finishWalletEditing") : t("view.addWallet")}
                          aria-pressed={walletsEditMode}
                        />
                      }
                      onClick={() => setWalletsEditMode((current) => !current)}
                      disabled={pending}
                    >
                      <WalletCards />
                    </TooltipTrigger>
                    <TooltipContent>
                      {walletsEditMode ? t("view.finishWalletEditing") : t("view.addWallet")}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {!hasAccounts ? (
                <div className="rounded-[var(--radius-control)] border border-dashed border-border/70 bg-background/65 px-4 py-3 type-body-14 text-muted-foreground">
                  {walletsEditMode ? copy("view.emptyEditHint") : copy("view.emptyHint")}
                </div>
              ) : null}

              {actionError ? (
                <div className="rounded-[var(--radius-control)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {actionError}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="mobile-nav-scroll-clearance min-h-0 flex-1 overflow-auto px-3 py-2 [scroll-padding-bottom:calc(76px+env(safe-area-inset-bottom))] sm:px-6 sm:py-4 lg:px-7 lg:[scroll-padding-bottom:1rem]"
            onScroll={(event) => setLeftPanelScrolled(event.currentTarget.scrollTop > 0)}
          >
            <div className="flex flex-col gap-8 lg:gap-10">
            <AccountList
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              editing={walletsEditMode}
              showMinorUnits={showMinorUnits}
              onSelect={(accountId) => {
                setSelectedAccountId((current) => {
                  const nextId = current === accountId ? null : accountId;

                  if (!isDesktopViewport()) {
                    setMobileRegisterOpen(Boolean(nextId));
                  }

                  return nextId;
                });
              }}
              onAddAccount={openAddWallet}
              onEditAccount={openEditWallet}
              onDeleteAccount={handleDeleteWallet}
              onAdjustBalance={handleAdjustBalance}
              allocations={allocations}
              onAddGoal={(walletId) => {
                setGoalWalletId(walletId);
                setGoalSheetMode("add");
                setEditingAllocation(null);
                setGoalSheetOpen(true);
              }}
              onEditGoal={(allocation) => {
                setGoalWalletId(allocation.wallet_id);
                setGoalSheetMode("edit");
                setEditingAllocation(allocation);
                setGoalSheetOpen(true);
              }}
              onDeleteGoal={(allocation) => deleteGoalOptimistic(allocation.id)}
            />
            <InvestmentList
              positions={investmentPositions}
              transactions={transactions}
              selectedId={selectedInvestmentId}
              editing={walletsEditMode}
              onAdd={() => setInvestmentSheetOpen(true)}
              onSelect={(positionId) => {
                setSelectedAccountId(null);
                setSelectedInvestmentId(positionId);
              }}
            />
            </div>
          </div>
        </section>

        {selectedInvestment ? (
          <InvestmentDetail
            position={selectedInvestment}
            transactions={transactions}
            onClose={() => setSelectedInvestmentId(null)}
            onAddPurchase={() => {
              setPurchaseInstrumentId(selectedInvestment.instrument_id);
              setTransactionSheetMode("add");
              setEditingTransaction(null);
              setTransactionSheetOpen(true);
            }}
          />
        ) : <BalanceRegisterPanel
          selectedAccount={selectedAccount}
          transactions={filteredRegister}
          showMinorUnits={showMinorUnits}
          startDate={registerDateFrom}
          endDate={registerDateTo}
          defaultStartDate={defaultRegisterDateFrom}
          onStartDateChange={setRegisterDateFrom}
          onEndDateChange={setRegisterDateTo}
          onAddTransaction={openAddTransaction}
          onTransactionClick={openTransactionEditor}
          onEditOccurrence={openTransactionEditor}
          onDeleteTransaction={(transaction) => {
            transactionActions.deleteTransactionOptimistic(transaction.id);
          }}
          onMarkPaid={(transaction) => {
            transactionActions.markPaidOptimistic(transaction.id);
          }}
          onSkipOccurrence={(transaction) => {
            transactionActions.skipOccurrenceOptimistic(transaction.id);
          }}
          onClearSelection={() => {
            setSelectedAccountId(null);
          }}
        />}
      </div>

      <Sheet
        open={mobileRegisterOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMobileRegister();
          }
        }}
      >
        <SheetContent
          side="fullscreen"
          className="gap-0 p-0 lg:hidden"
          showCloseButton={false}
        >
          <div className="min-h-0 flex-1 overflow-auto" onScroll={(event) => setMobileRegisterScrolled(event.currentTarget.scrollTop > 0)}>
            <BalanceRegisterHeader
              title={registerTitle}
              startDate={registerDateFrom}
              endDate={registerDateTo}
              defaultStartDate={defaultRegisterDateFrom}
              onStartDateChange={setRegisterDateFrom}
              onEndDateChange={setRegisterDateTo}
              onClearSelection={() => {
                setSelectedAccountId(null);
                setMobileRegisterOpen(false);
              }}
              showClearSelection={Boolean(selectedAccount)}
              onAddTransaction={openAddTransaction}
              onBack={closeMobileRegister}
              scrolled={mobileRegisterScrolled}
            />

            <div className="px-4 pb-4 pt-2">
              <TransactionList
                transactions={filteredRegister}
                emptyMessage={
                  selectedAccount
                    ? t("messages.noTransactionsForWallet")
                    : tr("common.empty.noTransactionsYet")
                }
                groupByDate
                showMinorUnits={showMinorUnits}
                onTransactionClick={openTransactionEditor}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TransactionFormSheet
        open={transactionSheetOpen}
        mode={transactionSheetMode}
        transaction={editingTransaction}
        defaultSourceAccountId={transactionSheetMode === "add" ? selectedAccountId : null}
        accounts={accounts}
        categories={categories}
        allocations={allocations}
        investmentPositions={investmentPositions}
        initialInvestmentInstrumentId={purchaseInstrumentId}
        onOpenChange={(open) => {
          setTransactionSheetOpen(open);
          if (!open) setPurchaseInstrumentId(null);
        }}
        onSubmit={(payload: TransactionFormSubmitPayload) => {
          const onError = (error: unknown) =>
            setActionError(error instanceof Error ? error.message : tr("transactions.view.saveError"));
          if (payload.kind === "entry" || payload.kind === "entry-batch") {
            transactionActions.createEntry(payload.values, { onError });
          } else if (payload.kind === "transaction" && editingTransaction) {
            transactionActions.updateTransactionOptimistic(editingTransaction.id, payload.values, { onError });
            if (payload.rescheduleFrom) {
              transactionActions.rescheduleFromDate(
                payload.rescheduleFrom.scheduleId,
                payload.rescheduleFrom.originalDate,
                payload.rescheduleFrom.newDate,
                { onError },
              );
            }
          }
          setActionError(null);
        }}
      />

      <InvestmentPositionSheet
        open={investmentSheetOpen}
        onOpenChange={setInvestmentSheetOpen}
        initialInstruments={investmentInstruments}
        onSubmit={(instrument, openingUnits) => {
          financeActions.saveInvestmentPosition(instrument, openingUnits, {
            onError: (error) => setActionError(error instanceof Error ? error.message : tr("common.errors.requestFailed")),
          });
          setInvestmentSheetOpen(false);
        }}
      />

      <AccountFormSheet
        open={walletSheetOpen}
        mode={walletSheetMode}
        account={editingAccount}
        initialType={draftWalletType}
        onOpenChange={setWalletSheetOpen}
        onSubmit={handleSaveWallet}
      />

      <GoalFormSheet
        open={goalSheetOpen}
        mode={goalSheetMode}
        allocation={editingAllocation}
        onOpenChange={setGoalSheetOpen}
        onSubmit={(values) => {
          financeActions.saveAllocation(
            goalSheetMode,
            values,
            goalWalletId ?? undefined,
            editingAllocation?.id,
            {
              onError: (error) =>
                setActionError(error instanceof Error ? error.message : t("messages.saveWalletError")),
            },
          );
          setActionError(null);
        }}
      />
    </>
  );
}
