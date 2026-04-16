"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, FileUp, Upload } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useBankingData } from "@/features/banking/hooks/use-banking-data";
import { bankingSnapshotQueryKey } from "@/features/banking/lib/banking-api";
import { useMcpBatches, mcpBatchesQueryKey } from "@/features/inbox/hooks/use-mcp-batches";
import { McpBatchSection } from "@/features/inbox/components/mcp-batch-section";
import { CsvBatchSection } from "@/features/inbox/components/csv-batch-section";
import { CsvUploadSheet } from "@/features/inbox/components/csv-upload-sheet";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Filter tab types
// ---------------------------------------------------------------------------

type Filter = "all" | "claude" | "csv";

// ---------------------------------------------------------------------------
// Unified batch list item (discriminated union for sorting)
// ---------------------------------------------------------------------------

type InboxEntry =
  | { source: "claude"; batchId: string; createdAt: string }
  | { source: "csv"; batchId: string; createdAt: string };

// ---------------------------------------------------------------------------
// Filter pill button
// ---------------------------------------------------------------------------

function FilterPill({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      {count > 0 && (
        <span
          className={cn(
            "flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none",
            active ? "bg-background/20 text-background" : "bg-foreground/10 text-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function InboxView() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = useTranslations("inbox" as any) as (key: string) => string;

  const [filter, setFilter] = useState<Filter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  const qc = useQueryClient();

  // Data sources
  const bankingQuery = useBankingData();
  const mcpQuery = useMcpBatches();

  // Called by McpBatchSection after approve/reject — refetch so the approved
  // batch disappears from the list (the query filters by status=pending).
  function handleMcpFinalized() {
    void qc.invalidateQueries({ queryKey: mcpBatchesQueryKey });
  }

  // Called by CsvBatchSection after confirm/delete — refetch the banking
  // snapshot so the batch disappears once all its drafts are gone.
  function handleCsvFinalized() {
    void qc.invalidateQueries({ queryKey: bankingSnapshotQueryKey });
  }

  const bankingData = bankingQuery.data;
  const mcpBatches = mcpQuery.data ?? [];

  // CSV batches with their draft transactions
  const csvBatches = bankingData
    ? bankingData.batches.filter((b) => {
        const draftCount = bankingData.draftTransactions.filter((tx) => tx.batch_id === b.id).length;
        return draftCount > 0;
      })
    : [];

  // Build a sorted list of entries for the unified feed
  const allEntries: InboxEntry[] = [
    ...mcpBatches.map((b) => ({ source: "claude" as const, batchId: b.id, createdAt: b.created_at })),
    ...csvBatches.map((b) => ({ source: "csv" as const, batchId: b.id, createdAt: b.created_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredEntries = allEntries.filter((entry) => {
    if (filter === "claude") return entry.source === "claude";
    if (filter === "csv") return entry.source === "csv";
    return true;
  });

  const claudeCount = mcpBatches.length;
  const csvCount = csvBatches.length;
  const totalCount = claudeCount + csvCount;

  const categories = bankingData?.categories ?? [];
  const wallets = bankingData?.wallets ?? [];

  const isLoading = bankingQuery.isLoading || mcpQuery.isLoading;

  return (
    <>
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6 sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{t("title")}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => setUploadOpen(true)}
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("importCsv")}</span>
          <span className="sm:hidden">CSV</span>
        </Button>
      </div>

      {/* Filter tabs */}
      {!isLoading && totalCount > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterPill
            active={filter === "all"}
            count={totalCount}
            label={t("filterAll")}
            onClick={() => setFilter("all")}
          />
          <FilterPill
            active={filter === "claude"}
            count={claudeCount}
            icon={Bot}
            label={t("filterClaude")}
            onClick={() => setFilter("claude")}
          />
          <FilterPill
            active={filter === "csv"}
            count={csvCount}
            icon={FileUp}
            label={t("filterCsv")}
            onClick={() => setFilter("csv")}
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-muted/40"
            />
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              {t("importCsv")}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filteredEntries.map((entry) => {
            if (entry.source === "claude") {
              const batch = mcpBatches.find((b) => b.id === entry.batchId);
              if (!batch) return null;
              return (
                <McpBatchSection
                  key={batch.id}
                  batch={batch}
                  categories={categories}
                  accounts={wallets}
                  onFinalized={handleMcpFinalized}
                />
              );
            }

            if (entry.source === "csv" && bankingData) {
              const batch = bankingData.batches.find((b) => b.id === entry.batchId);
              const txs = bankingData.draftTransactions.filter((tx) => tx.batch_id === entry.batchId);
              if (!batch || txs.length === 0) return null;
              return (
                <CsvBatchSection
                  key={batch.id}
                  batch={batch}
                  transactions={txs}
                  categories={categories}
                  wallets={wallets}
                  onFinalized={handleCsvFinalized}
                />
              );
            }

            return null;
          })}
        </div>
      )}

      {/* CSV Upload Sheet */}
      <CsvUploadSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        wallets={wallets}
      />
    </>
  );
}
