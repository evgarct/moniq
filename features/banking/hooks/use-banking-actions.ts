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
import { createDualQueueRequest } from "@/features/banking/lib/dual-queue-request";
import {
  BankingMutationCoordinator,
  type BankingCommand,
} from "@/features/banking/lib/optimistic-coordinator";
import {
  addImportedTransactionsToFinance,
  confirmImportedTransactionsInBanking,
  deleteImportedTransaction,
  deleteImportBatch,
  type ImportedTransactionPatch,
  updateImportedTransaction,
} from "@/features/banking/lib/optimistic-state";
import { getFinanceMutationCoordinator } from "@/features/finance/lib/coordinator-registry";
import type { TransactionImportSnapshot } from "@/types/imports";

const coordinators = new WeakMap<QueryClient, BankingMutationCoordinator>();
let commandSequence = 0;

function getCoordinator(queryClient: QueryClient) {
  const existing = coordinators.get(queryClient);
  if (existing) return existing;
  const coordinator = new BankingMutationCoordinator({
    readBanking: () =>
      queryClient.getQueryData<TransactionImportSnapshot>(bankingSnapshotQueryKey),
    writeBanking: (snapshot) =>
      queryClient.setQueryData(bankingSnapshotQueryKey, snapshot),
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
  const financeCoordinator = useMemo(
    () => getFinanceMutationCoordinator(queryClient),
    [queryClient],
  );

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
          apply: (snapshot) =>
            updateImportedTransaction(snapshot, transactionId, values),
          request: () => updateImportedTransactionRequest(transactionId, values),
        },
        options,
      );
    },
    deleteTransaction(transactionId: string, options: ActionOptions) {
      execute(
        {
          apply: (snapshot) => deleteImportedTransaction(snapshot, transactionId),
          request: () => deleteImportedTransactionRequest(transactionId),
        },
        options,
      );
    },
    deleteBatch(batchId: string, options: ActionOptions) {
      execute(
        {
          apply: (snapshot) => deleteImportBatch(snapshot, batchId),
          request: () => deleteImportBatchRequest(batchId),
        },
        options,
      );
    },
    confirmTransactions(transactionIds: string[], options: ActionOptions) {
      const banking = queryClient.getQueryData<TransactionImportSnapshot>(
        bankingSnapshotQueryKey,
      );
      if (!banking) {
        const error = new Error();
        options.onError?.(error);
        toast.error(options.errorMessage);
        return;
      }
      const selected = banking?.draftTransactions.filter((transaction) =>
        transactionIds.includes(transaction.id),
      );
      let confirmed:
        | Awaited<ReturnType<typeof batchConfirmImportedTransactionsRequest>>
        | undefined;
      const startWhenBothQueuesAreReady = createDualQueueRequest(async () => {
        confirmed = await batchConfirmImportedTransactionsRequest(transactionIds);
        return confirmed;
      });

      commandSequence += 1;
      const financeCompletion = financeCoordinator.execute({
        id: `banking-finance-command:${commandSequence}`,
        apply: (snapshot) => addImportedTransactionsToFinance(snapshot, selected),
        request: async () => (await startWhenBothQueuesAreReady("finance")).finance,
        reconcile: () =>
          transactionIds.flatMap((transactionId) => {
            const serverId = confirmed?.banking.confirmedTransactions.find(
              (transaction) => transaction.id === transactionId,
            )?.finance_transaction_id;
            return serverId
              ? [[`optimistic:import:${transactionId}`, serverId] as const]
              : [];
          }),
      });
      void financeCompletion.catch(() => undefined);

      execute(
        {
          apply: (snapshot) =>
            confirmImportedTransactionsInBanking(snapshot, transactionIds),
          request: async () => (await startWhenBothQueuesAreReady("banking")).banking,
        },
        options,
      );
    },
  };
}
