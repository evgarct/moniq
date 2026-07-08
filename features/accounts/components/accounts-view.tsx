"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Info, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountList } from "@/components/account-list";
import { PageHeader } from "@/components/page-header";
import { PageHeaderIconButton } from "@/components/page-header-icon-button";
import { TransactionList } from "@/components/transaction-list";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [walletSheetMode, setWalletSheetMode] = useState<"add" | "edit">("add");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [draftWalletType, setDraftWalletType] = useState<Account["type"]>("cash");
  const [walletsEditMode, setWalletsEditMode] = useState(false);
  const [showMinorUnits, setShowMinorUnits] = useState(false);
  const [mobileRegisterOpen, setMobileRegisterOpen] = useState(false);
  const [mobileInvestmentOpen, setMobileInvestmentOpen] = useState(false);
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

  const selectedAllocation = selectedAllocationId ? allocations.find((a) => a.id === selectedAllocationId) ?? null : null;
  const selectedAccount = selectedAccountId
    ? accounts.find((account) => account.id === selectedAccountId) ?? null
    : (selectedAllocation ? accounts.find((account) => account.id === selectedAllocation.wallet_id) ?? null : null);
  const selectedInvestment = selectedInvestmentId
    ? investmentPositions.find((position) => position.id === selectedInvestmentId) ?? null
    : null;
  const investmentInstruments = useMemo(
    () => investmentPositions.map((position) => position.instrument),
    [investmentPositions],
  );
  const investmentCategoryId = categories.find((category) => category.purpose === "investment")?.id ?? null;
  const settledTransactions = useMemo(
    () =>
      [...transactions]
        .filter((transaction) => isSettledTransactionStatus(transaction.status))
        .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at)),
    [transactions],
  );
  const register = selectedAllocation
    ? settledTransactions.filter((transaction) => transaction.allocation_id === selectedAllocation.id)
    : (selectedAccount
      ? getTransactionsForAccount(settledTransactions, selectedAccount.id)
      : settledTransactions);
  const filteredRegister = register.filter((transaction) => {
    const occurredOn = transaction.occurred_at.slice(0, 10);
    if (registerDateFrom && occurredOn < registerDateFrom) return false;
    if (registerDateTo && occurredOn > registerDateTo) return false;
    return true;
  });
  const pending = false;
  const hasAccounts = accounts.length > 0;
  const registerTitle = selectedAllocation ? selectedAllocation.name : (selectedAccount ? selectedAccount.name : t("view.activity"));
  const isDesktopViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  function closeMobileRegister() {
    setMobileRegisterOpen(false);
    setSelectedAccountId(null);
    setSelectedAllocationId(null);
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
          <PageHeader
            title={t("view.title")}
            scrolled={leftPanelScrolled}
            tone="panel"
            actions={
              <div
                className="flex shrink-0 items-center gap-1 sm:gap-2"
                role="toolbar"
                aria-label={t("view.title")}
              >
                <PageHeaderIconButton
                  icon={Info}
                  label={walletsEditMode ? copy("view.editModeDescription") : t("view.description")}
                  className="hidden shrink-0 lg:inline-flex"
                />
                <PageHeaderIconButton
                  icon={showMinorUnits ? Eye : EyeOff}
                  label={showMinorUnits ? copy("view.hideMinorUnits") : copy("view.showMinorUnits")}
                  pressed={showMinorUnits}
                  onClick={() => setShowMinorUnits((current) => !current)}
                />
                <PageHeaderIconButton
                  icon={WalletCards}
                  label={walletsEditMode ? t("view.finishWalletEditing") : t("view.addWallet")}
                  pressed={walletsEditMode}
                  onClick={() => setWalletsEditMode((current) => !current)}
                  disabled={pending}
                />
              </div>
            }
          />
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
                setSelectedAllocationId(null);
                setSelectedInvestmentId(null);
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
              selectedAllocationId={selectedAllocationId}
              onSelectGoal={(allocationId) => {
                setSelectedAllocationId((current) => {
                  const nextId = current === allocationId ? null : allocationId;

                  if (!isDesktopViewport()) {
                    setMobileRegisterOpen(Boolean(nextId));
                  }

                  return nextId;
                });
                setSelectedAccountId(null);
                setSelectedInvestmentId(null);
              }}
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
                if (!isDesktopViewport()) setMobileInvestmentOpen(true);
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
            setSelectedAllocationId(null);
          }}
          title={registerTitle}
          emptyMessage={
            selectedAllocation
              ? t("messages.noTransactionsForWallet")
              : (selectedAccount
                ? t("messages.noTransactionsForWallet")
                : tr("common.empty.noTransactionsYet"))
          }
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
                setSelectedAllocationId(null);
                setMobileRegisterOpen(false);
              }}
              showClearSelection={Boolean(selectedAccount || selectedAllocation)}
              onAddTransaction={openAddTransaction}
              onBack={closeMobileRegister}
              scrolled={mobileRegisterScrolled}
            />

            <div className="px-4 pb-4 pt-2">
              <TransactionList
                transactions={filteredRegister}
                emptyMessage={
                  selectedAllocation
                    ? t("messages.noTransactionsForWallet")
                    : (selectedAccount
                      ? t("messages.noTransactionsForWallet")
                      : tr("common.empty.noTransactionsYet"))
                }
                groupByDate
                showMinorUnits={showMinorUnits}
                onTransactionClick={openTransactionEditor}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={mobileInvestmentOpen}
        onOpenChange={(open) => {
          setMobileInvestmentOpen(open);
          if (!open) setSelectedInvestmentId(null);
        }}
      >
        <SheetContent side="fullscreen" className="gap-0 p-0 lg:hidden" showCloseButton={false}>
          {selectedInvestment ? (
            <InvestmentDetail
              position={selectedInvestment}
              transactions={transactions}
              mobile
              onClose={() => {
                setMobileInvestmentOpen(false);
                setSelectedInvestmentId(null);
              }}
              onAddPurchase={() => {
                setPurchaseInstrumentId(selectedInvestment.instrument_id);
                setTransactionSheetMode("add");
                setEditingTransaction(null);
                setTransactionSheetOpen(true);
              }}
            />
          ) : null}
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
        initialCategoryId={purchaseInstrumentId ? investmentCategoryId : null}
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
