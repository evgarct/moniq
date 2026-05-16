"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, FileUp, Info, Upload } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBankingData } from "@/features/banking/hooks/use-banking-data";
import { useMcpBatches, mcpBatchesQueryKey } from "@/features/inbox/hooks/use-mcp-batches";
import { bankingSnapshotQueryKey } from "@/features/banking/lib/banking-api";
import { financeSnapshotQueryKey } from "@/features/finance/lib/finance-api";
import { McpBatchSection } from "@/features/inbox/components/mcp-batch-section";
import { CsvBatchSection } from "@/features/inbox/components/csv-batch-section";
import { CsvUploadSheet } from "@/features/inbox/components/csv-upload-sheet";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Filter tab types
// ---------------------------------------------------------------------------

type Filter = "all" | "claude" | "csv";

type InboxEntry =
  | { source: "claude"; batchId: string; createdAt: string; title: string; itemCount: number }
  | { source: "csv"; batchId: string; createdAt: string; title: string; itemCount: number };

type Selection = {
  source: "claude" | "csv";
  batchId: string;
};

// ---------------------------------------------------------------------------
// Filter tab button
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
        "flex items-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-1.5 text-sm font-medium transition-colors",
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
            "tabular-nums text-[11px] font-semibold leading-none",
            active ? "text-background/80" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function InboxView() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = useTranslations("inbox" as any) as (key: string) => string;
  const claudeT = useTranslations("claudeInbox");
  const importsT = useTranslations("imports");
  const [filter, setFilter] = useState<Filter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [leftPanelScrolled, setLeftPanelScrolled] = useState(false);
  const [rightPanelScrolled, setRightPanelScrolled] = useState(false);

  const qc = useQueryClient();

  function handleMcpFinalized() {
    void qc.invalidateQueries({ queryKey: mcpBatchesQueryKey });
    void qc.invalidateQueries({ queryKey: financeSnapshotQueryKey });
  }
  function handleCsvFinalized() {
    void qc.invalidateQueries({ queryKey: bankingSnapshotQueryKey });
    void qc.invalidateQueries({ queryKey: financeSnapshotQueryKey });
  }

  // Data sources
  const bankingQuery = useBankingData();
  const mcpQuery = useMcpBatches();

  const bankingData = bankingQuery.data;
  const mcpBatches = useMemo(() => mcpQuery.data ?? [], [mcpQuery.data]);

  // CSV batches with their draft transactions
  const csvBatches = useMemo(
    () =>
      bankingData
        ? bankingData.batches.filter((b) => {
            const draftCount = bankingData.draftTransactions.filter((tx) => tx.batch_id === b.id).length;
            return draftCount > 0;
          })
        : [],
    [bankingData],
  );

  const allEntries: InboxEntry[] = useMemo(
    () =>
      [
        ...mcpBatches.map((b) => ({
          source: "claude" as const,
          batchId: b.id,
          createdAt: b.created_at,
          title: b.source_description ?? claudeT("batch.defaultTitle"),
          itemCount: b.mcp_batch_items.length,
        })),
        ...csvBatches.map((b) => ({
          source: "csv" as const,
          batchId: b.id,
          createdAt: b.created_at,
          title: b.file_name,
          itemCount: bankingData?.draftTransactions.filter((tx) => tx.batch_id === b.id).length ?? 0,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [bankingData?.draftTransactions, claudeT, csvBatches, mcpBatches],
  );

  const filteredEntries = useMemo(
    () =>
      allEntries.filter((entry) => {
        if (filter === "claude") return entry.source === "claude";
        if (filter === "csv") return entry.source === "csv";
        return true;
      }),
    [allEntries, filter],
  );

  const claudeCount = mcpBatches.length;
  const csvCount = csvBatches.length;
  const totalCount = claudeCount + csvCount;

  const categories = bankingData?.categories ?? [];
  const wallets = bankingData?.wallets ?? [];

  const isLoading = bankingQuery.isLoading || mcpQuery.isLoading;
  const selectedEntry = selected
    ? filteredEntries.find((entry) => entry.source === selected.source && entry.batchId === selected.batchId) ?? null
    : null;
  const activeEntry = selectedEntry ?? filteredEntries[0] ?? null;

  function openDetails(entry: InboxEntry) {
    const nextSelection: Selection = { source: entry.source, batchId: entry.batchId };
    setSelected(nextSelection);
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
      setMobileDetailsOpen(true);
    }
  }

  function renderSelectedSection(entry: InboxEntry | null) {
    if (!entry) {
      return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;
    }

    if (entry.source === "claude") {
      const batch = mcpBatches.find((item) => item.id === entry.batchId);
      if (!batch) {
        return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;
      }
      return (
        <McpBatchSection
          batch={batch}
          categories={categories}
          accounts={wallets}
          onFinalized={handleMcpFinalized}
        />
      );
    }

    if (!bankingData) {
      return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;
    }

    const batch = bankingData.batches.find((item) => item.id === entry.batchId);
    const txs = bankingData.draftTransactions.filter((tx) => tx.batch_id === entry.batchId);
    if (!batch || txs.length === 0) {
      return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;
    }

    return (
      <CsvBatchSection
        batch={batch}
        transactions={txs}
        categories={categories}
        wallets={wallets}
        onFinalized={handleCsvFinalized}
      />
    );
  }

  return (
    <>
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col border-b border-border/40 bg-card lg:border-r lg:border-b-0 lg:border-r-border/25">
          <div
            className={cn(
              "bg-card/96 backdrop-blur transition-shadow supports-[backdrop-filter]:bg-card/88",
              leftPanelScrolled && "shadow-[0_10px_24px_-22px_rgba(28,22,17,0.75)]",
            )}
          >
            <div className="flex flex-col gap-3 px-3 pt-4 pb-3 sm:gap-4 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
              <div className="flex items-start justify-between gap-3 px-1.5 sm:items-center sm:px-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="min-w-0 truncate font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
                    {t("title")}
                  </h1>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
                          aria-label={t("description")}
                        />
                      }
                    >
                      <Info className="size-4 translate-y-[2px]" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72 text-balance">{t("description")}</TooltipContent>
                  </Tooltip>
                </div>

                <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  {t("importCsv")}
                </Button>
              </div>

              {!isLoading && totalCount > 0 ? (
                <div className="flex flex-wrap gap-2 px-1.5 sm:px-2.5">
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
              ) : null}
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-auto px-3 py-2 sm:px-6 sm:py-4 lg:px-7"
            onScroll={(event) => setLeftPanelScrolled(event.currentTarget.scrollTop > 0)}
          >
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-[var(--radius-control)] bg-muted/40" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <EmptyState
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-3.5 w-3.5" />
                    {t("importCsv")}
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col">
                {filteredEntries.map((entry) => {
                  const isActive = activeEntry?.source === entry.source && activeEntry.batchId === entry.batchId;
                  const SourceIcon = entry.source === "claude" ? Bot : FileUp;
                  const sourceLabel = entry.source === "claude" ? t("filterClaude") : t("filterCsv");

                  return (
                    <button
                      key={`${entry.source}:${entry.batchId}`}
                      type="button"
                      onClick={() => openDetails(entry)}
                      className={cn(
                        "flex w-full items-start gap-3 border-t border-border px-2 py-3 text-left first:border-t-0",
                        "hover:bg-secondary/50",
                        isActive && "bg-secondary/60",
                      )}
                    >
                      <SourceIcon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <div className="min-w-0 flex-1">
                        <p className="type-body-14 truncate font-medium text-foreground">{entry.title}</p>
                        <p className="type-body-12 text-muted-foreground">
                          {sourceLabel} · {formatDateLabel(entry.createdAt)} ·{" "}
                          {entry.source === "claude"
                            ? claudeT("batch.items", { count: entry.itemCount })
                            : importsT("inbox.count", { count: entry.itemCount })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="hidden min-h-0 flex-col bg-background lg:flex">
          <div
            className={cn(
              "sticky top-0 z-10 bg-background/94 backdrop-blur transition-shadow supports-[backdrop-filter]:bg-background/84",
              rightPanelScrolled && "shadow-[0_10px_24px_-22px_rgba(28,22,17,0.75)]",
            )}
          >
            <div className="px-3 pt-4 pb-3 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
              <h2 className="min-w-0 truncate font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
                {activeEntry?.title ?? t("title")}
              </h2>
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-2 sm:px-6 sm:pb-5 lg:px-7"
            onScroll={(event) => setRightPanelScrolled(event.currentTarget.scrollTop > 0)}
          >
            {renderSelectedSection(activeEntry)}
          </div>
        </section>
      </div>

      <Sheet open={mobileDetailsOpen} onOpenChange={setMobileDetailsOpen}>
        <SheetContent side="fullscreen" className="gap-0 p-0 lg:hidden" showCloseButton={false}>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="sticky top-0 z-10 bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/84">
              <div className="px-4 pt-5 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate font-heading text-[24px] leading-none tracking-[-0.03em] text-foreground">
                    {activeEntry?.title ?? t("title")}
                  </h2>
                  <Button type="button" size="sm" variant="outline" onClick={() => setMobileDetailsOpen(false)}>
                    {t("backToList")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4 pt-2">{renderSelectedSection(activeEntry)}</div>
          </div>
        </SheetContent>
      </Sheet>

      <CsvUploadSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        wallets={wallets}
      />
    </>
  );
}
