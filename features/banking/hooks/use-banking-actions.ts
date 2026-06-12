"use client";

import { useMemo } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  bankingSnapshotQueryKey,
  batchConfirmImportedTransactionsRequest,
  deleteImportedTransactionRequest,
  deleteImportBatchRequest,
  updateImportedTransactionRequest,
} from "@/features/banking/lib/banking-api";
import {
  BankingMutationCoordinator,
  type BankingCommand,
} from "@/features/banking/lib/optimistic-coordinator";
import {
  confirmImportedTransactions,
  deleteImportedTransaction,
  deleteImportBatch,
  type ImportedTransactionPatch,
  updateImportedTransaction,
} from "@/features/banking/lib/optimistic-state";
import {
  fetchFinanceSnapshot,
  financeSnapshotQueryKey,
} from "@/features/finance/lib/finance-api";
import type { FinanceSnapshot } from "@/types/finance";
import type { TransactionImportSnapshot } from "@/types/imports";

const coordinators = new WeakMap<QueryClient, BankingMutationCoordinator>();
let commandSequence = 0;

function getCoordinator(queryClient: QueryClient) {
  const existing = coordinators.get(queryClient);
  if (existing) return existing;
  const coordinator = new BankingMutationCoordinator({
    readBanking: () =>
      queryClient.getQueryData<TransactionImportSnapshot>(bankingSnapshotQueryKey),
    readFinance: () =>
      queryClient.getQueryData<FinanceSnapshot>(financeSnapshotQueryKey),
    writeBanking: (snapshot) =>
      queryClient.setQueryData(bankingSnapshotQueryKey, snapshot),
    writeFinance: (snapshot) =>
      queryClient.setQueryData(financeSnapshotQueryKey, snapshot),
  });
  coordinators.set(queryClient, coordinator);
  return coordinator;
}

type ActionOptions = {
  errorMessage: string;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
};

export function useBankingActions() {
  const queryClient = useQueryClient();
  const coordinator = useMemo(() => getCoordinator(queryClient), [queryClient]);

  function execute(command: Omit<BankingCommand, "id">, options: ActionOptions) {
    commandSequence += 1;
    const completion = coordinator.execute({
      ...command,
      id: `banking-command:${commandSequence}`,
      onError(error) {
        options.onError?.(error);
        toast.error(
          error instanceof Error && error.message ? error.message : options.errorMessage,
        );
      },
    });
    void completion.then(
      () => options.onSuccess?.(),
      () => undefined,
    );
  }

  return {
    updateTransaction(
      transactionId: string,
      values: ImportedTransactionPatch,
      options: ActionOptions,
    ) {
      execute(
        {
          apply: (state) => ({
            ...state,
            banking: updateImportedTransaction(state.banking, transactionId, values),
          }),
          request: async () => ({
            banking: await updateImportedTransactionRequest(transactionId, values),
          }),
        },
        options,
      );
    },
    deleteTransaction(transactionId: string, options: ActionOptions) {
      execute(
        {
          apply: (state) => ({
            ...state,
            banking: deleteImportedTransaction(state.banking, transactionId),
          }),
          request: async () => ({
            banking: await deleteImportedTransactionRequest(transactionId),
          }),
        },
        options,
      );
    },
    deleteBatch(batchId: string, options: ActionOptions) {
      execute(
        {
          apply: (state) => ({
            ...state,
            banking: deleteImportBatch(state.banking, batchId),
          }),
          request: async () => ({
            banking: await deleteImportBatchRequest(batchId),
          }),
        },
        options,
      );
    },
    confirmTransactions(transactionIds: string[], options: ActionOptions) {
      execute(
        {
          apply: (state) =>
            state.finance
              ? confirmImportedTransactions(state.banking, state.finance, transactionIds)
              : {
                  ...state,
                  banking: {
                    ...state.banking,
                    draftTransactions: state.banking.draftTransactions.filter(
                      (transaction) => !transactionIds.includes(transaction.id),
                    ),
                  },
                },
          request: async () => {
            const banking = await batchConfirmImportedTransactionsRequest(transactionIds);
            const finance = await fetchFinanceSnapshot().catch(() =>
              queryClient.getQueryData<FinanceSnapshot>(financeSnapshotQueryKey),
            );
            return { banking, finance };
          },
        },
        options,
      );
    },
  };
}
