import { useState } from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Check, PencilLine, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { PageContainer } from "@/components/page-container";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { StoryWorkspace, makeFinanceSnapshot, type Story, withPathname } from "@/stories/fixtures/story-data";
import type { Account, Category, Transaction } from "@/types/finance";
import type { TransactionImport } from "@/types/imports";

const KIND_OPTIONS = ["expense", "income", "transfer", "debt_payment"] as const;

const snapshot = makeFinanceSnapshot();
const wallets = snapshot.accounts.filter((account) => account.type !== "debt");
const debtWallets = snapshot.accounts.filter((account) => account.type === "debt");
const categories = snapshot.categories.filter((category) => category.type === "expense" || category.type === "income");


function buildImport(
  overrides: Partial<TransactionImport> & {
    id: string;
    wallet: Account;
    amount: number;
    occurred_at: string;
    merchant_clean: string;
    kind: "expense" | "income" | "transfer" | "debt_payment";
  },
): TransactionImport {
  const {
    id,
    wallet,
    amount,
    occurred_at,
    merchant_clean,
    kind,
    ...rest
  } = overrides;

  return {
    id,
    user_id: "storybook-user",
    batch_id: "storybook-batch",
    wallet_id: wallet.id,
    finance_transaction_id: null,
    external_id: null,
    row_index: 1,
    fingerprint: `fingerprint-${id}`,
    amount,
    currency: wallet.currency,
    occurred_at,
    kind,
    counterpart_wallet_id: rest.counterpart_wallet_id ?? null,
    merchant_raw: merchant_clean,
    merchant_clean,
    category_id: rest.category_id ?? null,
    category: rest.category ?? null,
    status: "draft",
    batch: null,
    wallet,
    counterpart_wallet: rest.counterpart_wallet ?? null,
    finance_transaction: null,
    created_at: occurred_at,
    updated_at: occurred_at,
    ...rest,
  };
}

const sampleImports: TransactionImport[] = [
  buildImport({
    id: "import-1",
    wallet: wallets[0],
    amount: -245.5,
    occurred_at: "2026-04-10T08:15:00.000Z",
    merchant_clean: "Albert Dejvice",
    kind: "expense",
    category_id: categories.find((category) => category.type === "expense")?.id ?? null,
    category: categories.find((category) => category.type === "expense") ?? null,
  }),
  buildImport({
    id: "import-2",
    wallet: wallets[0],
    amount: -89,
    occurred_at: "2026-04-10T12:40:00.000Z",
    merchant_clean: "Večerka",
    kind: "expense",
  }),
  buildImport({
    id: "import-3",
    wallet: wallets[0],
    amount: 30000,
    occurred_at: "2026-04-09T07:30:00.000Z",
    merchant_clean: "Salary April",
    kind: "income",
    category_id: categories.find((category) => category.type === "income")?.id ?? null,
    category: categories.find((category) => category.type === "income") ?? null,
  }),
  buildImport({
    id: "import-4",
    wallet: wallets[0],
    counterpart_wallet_id: wallets[1]?.id ?? null,
    counterpart_wallet: wallets[1] ?? null,
    amount: -5000,
    occurred_at: "2026-04-08T18:20:00.000Z",
    merchant_clean: "Move to EUR reserve",
    kind: "transfer",
  }),
  buildImport({
    id: "import-5",
    wallet: wallets[0],
    counterpart_wallet_id: debtWallets[0]?.id ?? null,
    counterpart_wallet: debtWallets[0] ?? null,
    amount: -4200,
    occurred_at: "2026-04-08T09:10:00.000Z",
    merchant_clean: "Loan repayment",
    kind: "debt_payment",
  }),
];

function mapImportedTransactionToRow(transaction: TransactionImport): Transaction {
  return {
    id: transaction.id,
    user_id: transaction.user_id,
    title: transaction.merchant_clean,
    note: transaction.merchant_clean,
    occurred_at: transaction.occurred_at,
    created_at: transaction.created_at,
    status: "paid",
    kind: transaction.kind,
    amount: Math.abs(transaction.amount),
    destination_amount: transaction.kind === "transfer" ? Math.abs(transaction.amount) : null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: transaction.category_id,
    source_account_id:
      transaction.kind === "income"
        ? null
        : transaction.kind === "transfer"
          ? transaction.amount < 0
            ? transaction.wallet_id
            : transaction.counterpart_wallet_id
          : transaction.kind === "debt_payment"
            ? transaction.wallet_id
          : transaction.wallet_id,
    destination_account_id:
      transaction.kind === "expense"
        ? null
        : transaction.kind === "transfer"
          ? transaction.amount < 0
            ? transaction.counterpart_wallet_id
            : transaction.wallet_id
          : transaction.kind === "debt_payment"
            ? transaction.counterpart_wallet_id
          : transaction.wallet_id,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    category: transaction.category,
    source_account:
      transaction.kind === "income"
        ? null
        : transaction.kind === "transfer"
          ? transaction.amount < 0
            ? transaction.wallet
            : transaction.counterpart_wallet
          : transaction.kind === "debt_payment"
            ? transaction.wallet
          : transaction.wallet,
    destination_account:
      transaction.kind === "expense"
        ? null
        : transaction.kind === "transfer"
          ? transaction.amount < 0
            ? transaction.counterpart_wallet
            : transaction.wallet
          : transaction.kind === "debt_payment"
            ? transaction.counterpart_wallet
          : transaction.wallet,
    schedule: null,
  };
}

function ApprovalRowControls({
  transaction,
  categories,
  wallets,
  debtWallets,
  uncategorizedLabel,
  onPatch,
}: {
  transaction: TransactionImport;
  categories: Category[];
  wallets: Account[];
  debtWallets: Account[];
  uncategorizedLabel: string;
  onPatch: (values: Partial<TransactionImport>) => void;
}) {
  const t = useTranslations("imports");
  const categoryOptions = categories.filter((category) => category.type === transaction.kind);
  const selectableSourceWallets = wallets.filter((wallet) => wallet.id !== transaction.counterpart_wallet_id);
  const selectableCounterpartWallets = transaction.kind === "debt_payment"
    ? debtWallets
    : wallets.filter((wallet) => wallet.id !== transaction.wallet_id);
  const selectedKindLabel = t(`kinds.${transaction.kind}`);
  const selectedSourceWalletLabel =
    wallets.find((wallet) => wallet.id === transaction.wallet_id)?.name ?? t("review.fields.wallet");
  const selectedDestinationWalletLabel =
    transaction.kind === "debt_payment"
      ? debtWallets.find((wallet) => wallet.id === transaction.counterpart_wallet_id)?.name ?? t("review.fields.debtWallet")
      : selectableCounterpartWallets.find((wallet) => wallet.id === transaction.counterpart_wallet_id)?.name ??
        t("review.fields.wallet");
  return (
    <div className="grid w-[376px] shrink-0 grid-cols-[132px_232px] items-center gap-2">
      <Select
        value={transaction.kind}
        onValueChange={(value) => {
          onPatch({
            kind: value as "expense" | "income" | "transfer" | "debt_payment",
            category_id: value === "transfer" || value === "debt_payment" ? null : transaction.category_id,
            category: value === "transfer" || value === "debt_payment" ? null : transaction.category,
            counterpart_wallet_id: value === "transfer" || value === "debt_payment" ? null : null,
            counterpart_wallet: null,
          });
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-full justify-start border-transparent bg-transparent shadow-none hover:bg-muted/60"
        >
          <span className="truncate text-foreground">{selectedKindLabel}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {KIND_OPTIONS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {transaction.kind === "transfer" || transaction.kind === "debt_payment" ? (
        <div className="grid w-full grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-2">
          <Select
            value={transaction.wallet_id}
            onValueChange={(value) => {
              if (!value) {
                return;
              }

              const nextValues: Partial<TransactionImport> = {
                wallet_id: value,
                wallet: wallets.find((wallet) => wallet.id === value) ?? transaction.wallet,
                counterpart_wallet_id: value === transaction.counterpart_wallet_id ? null : transaction.counterpart_wallet_id,
                counterpart_wallet: value === transaction.counterpart_wallet_id ? null : transaction.counterpart_wallet,
              };

              onPatch(nextValues);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-full justify-start border-transparent bg-transparent shadow-none hover:bg-muted/60"
            >
              <span className="truncate text-foreground">{selectedSourceWalletLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {selectableSourceWallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="flex justify-center text-muted-foreground">→</div>

          <Select
            value={transaction.counterpart_wallet_id ?? "__none__"}
            onValueChange={(value) => {
              const nextWallet = selectableCounterpartWallets.find((wallet) => wallet.id === value) ?? null;
              onPatch({
                counterpart_wallet_id: value === "__none__" ? null : value,
                counterpart_wallet: value === "__none__" ? null : nextWallet,
              });
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-full justify-start border-transparent bg-transparent shadow-none hover:bg-muted/60"
            >
              <span className={cn("truncate", transaction.counterpart_wallet_id ? "text-foreground" : "text-muted-foreground")}>
                {selectedDestinationWalletLabel}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                {transaction.kind === "debt_payment" ? t("review.fields.debtWallet") : t("review.fields.wallet")}
              </SelectItem>
              <SelectGroup>
                {selectableCounterpartWallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <CategoryCascadePicker
          categories={categoryOptions}
          value={transaction.category_id}
          onSelect={(value) => {
            const nextCategory = categoryOptions.find((category) => category.id === value) ?? null;
            onPatch({
              category_id: value,
              category: value ? nextCategory : null,
            });
          }}
          placeholder={uncategorizedLabel}
          clearLabel={uncategorizedLabel}
          triggerClassName="h-7 w-full justify-start border-transparent bg-transparent shadow-none hover:bg-muted/60"
          contentClassName="min-w-[16rem]"
        />
      )}
    </div>
  );
}

function ImportApprovalListStory() {
  const [transactions, setTransactions] = useState(sampleImports);
  const t = useTranslations("imports");
  const transactionsT = useTranslations("transactions");

  const ledgerTransactions = transactions.map((transaction) => mapImportedTransactionToRow(transaction));
  const draftTransactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));

  return (
    <StoryWorkspace pathname="/en/imports">
      <PageContainer className="h-full overflow-hidden px-0 py-0 sm:px-0">
        <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
          <section className="border-r border-border/25 bg-card" />
          <section className="min-h-0 bg-background">
            <div className="h-full px-3 pt-4 pb-3 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
              <TransactionList
                transactions={ledgerTransactions}
                emptyMessage={t("inbox.emptyDescription")}
                groupByDate
                getRowClassName={() => "rounded-none px-2 py-1.5"}
                getPrimaryLabel={(ledgerTransaction) => {
                  const transaction = draftTransactionsById.get(ledgerTransaction.id);
                  if (!transaction) {
                    return ledgerTransaction.title;
                  }

                  // Mirror what toFinanceTransactionInput produces:
                  // title = category name (or merchant as fallback), note = merchant.
                  // buildPrimaryLabel renders "Category (merchant)" which is what we preview here.
                  const categoryLabel = transaction.category?.name?.trim() ?? null;
                  const merchantLabel = transaction.merchant_clean?.trim() || null;
                  const title = categoryLabel ?? merchantLabel ?? "—";
                  return merchantLabel && categoryLabel ? `${title} (${merchantLabel})` : title;
                }}
                getPrimaryLabelClassName={(ledgerTransaction) =>
                  draftTransactionsById.get(ledgerTransaction.id)?.category_id ? undefined : "text-secondary-foreground/70"
                }
                getSecondaryLabel={(ledgerTransaction) => {
                  const transaction = draftTransactionsById.get(ledgerTransaction.id);
                  if (!transaction) {
                    return undefined;
                  }

                  // For transfers and debt payments show the wallet flow.
                  // For expense/income the wallet is shown in the controls area.
                  if (transaction.kind === "transfer" || transaction.kind === "debt_payment") {
                    const walletLabel = transaction.wallet?.name ?? transactionsT("row.unlinkedAccount");
                    const counterpartWalletLabel =
                      transaction.counterpart_wallet?.name ?? transactionsT("row.unlinkedAccount");
                    return `${walletLabel} → ${counterpartWalletLabel}`;
                  }

                  return undefined;
                }}
                renderTrailingAccessory={(ledgerTransaction) => {
                  const transaction = draftTransactionsById.get(ledgerTransaction.id);
                  if (!transaction) {
                    return null;
                  }

                  return (
                    <ApprovalRowControls
                      transaction={transaction}
                      categories={categories}
                      wallets={wallets}
                      debtWallets={debtWallets}
                      uncategorizedLabel={transactionsT("row.uncategorized")}
                      onPatch={(values) => {
                        setTransactions((current) =>
                          current.map((item) => (item.id === transaction.id ? { ...item, ...values } : item)),
                        );
                      }}
                    />
                  );
                }}
                renderAction={(ledgerTransaction) => (
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-[10px] text-muted-foreground/70"
                            aria-label="Delete"
                          />
                        }
                      >
                        <Trash2 />
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-[10px] text-muted-foreground"
                            aria-label="Edit"
                          />
                        }
                      >
                        <PencilLine />
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                              "rounded-[10px] text-muted-foreground",
                              !draftTransactionsById.get(ledgerTransaction.id)?.category_id &&
                                !["transfer", "debt_payment"].includes(
                                  draftTransactionsById.get(ledgerTransaction.id)?.kind ?? "expense",
                                ) &&
                                "opacity-50",
                              (!draftTransactionsById.get(ledgerTransaction.id)?.counterpart_wallet_id &&
                                ["transfer", "debt_payment"].includes(
                                  draftTransactionsById.get(ledgerTransaction.id)?.kind ?? "expense",
                                )) &&
                                "opacity-50",
                            )}
                            aria-label="Confirm"
                          />
                        }
                      >
                        <Check />
                      </TooltipTrigger>
                      <TooltipContent>Confirm</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              />
            </div>
          </section>
        </div>
      </PageContainer>
    </StoryWorkspace>
  );
}

const meta = {
  title: "Pages/ImportApprovalList",
  component: ImportApprovalListStory,
  parameters: {
    layout: "fullscreen",
    ...withPathname("/en/imports"),
  },
} satisfies Meta<typeof ImportApprovalListStory>;

export default meta;

export const ReviewQueue: Story<typeof meta> = {};
