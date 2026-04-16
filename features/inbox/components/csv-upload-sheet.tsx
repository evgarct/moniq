"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileUp, SlidersHorizontal, Eye, EyeOff } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  bankingSnapshotQueryKey,
  fetchImportPreviewRequest,
  uploadMappedImportRequest,
} from "@/features/banking/lib/banking-api";
import type { Account } from "@/types/finance";
import type { ImportColumnKey, ImportColumnMapping, ImportFilePreview } from "@/types/imports";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASIC_FIELDS: Array<{ key: ImportColumnKey; required?: boolean }> = [
  { key: "date", required: true },
  { key: "description", required: true },
  { key: "amount" },
];

const ADVANCED_FIELDS: Array<{ key: ImportColumnKey }> = [
  { key: "debit" },
  { key: "credit" },
  { key: "currency" },
  { key: "type" },
  { key: "externalId" },
];

function canImport(mapping: ImportColumnMapping) {
  return Boolean(mapping.date && mapping.description && (mapping.amount || mapping.debit || mapping.credit));
}

// ---------------------------------------------------------------------------
// Mapping field selector
// ---------------------------------------------------------------------------

function MappingField({
  field,
  mapping,
  preview,
  t,
  onChange,
}: {
  field: { key: ImportColumnKey; required?: boolean };
  mapping: ImportColumnMapping;
  preview: ImportFilePreview;
  t: ReturnType<typeof useTranslations<"imports">>;
  onChange: (key: ImportColumnKey, value: string | null) => void;
}) {
  const selectedLabel =
    mapping[field.key] != null
      ? preview.columns.find((c) => c.key === mapping[field.key])?.label ?? null
      : null;

  return (
    <Field>
      <FieldLabel>
        {t(`mapping.fields.${field.key}`)}
        {field.required ? " *" : ""}
      </FieldLabel>
      <Select
        value={mapping[field.key] ?? "__none__"}
        onValueChange={(v) => onChange(field.key, v === "__none__" ? null : v)}
      >
        <SelectTrigger size="sm" className="w-full rounded-[10px] bg-background shadow-none">
          <SelectValue>{selectedLabel ?? t("mapping.selectColumn")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t("mapping.none")}</SelectItem>
          <SelectGroup>
            {preview.columns.map((col) => (
              <SelectItem key={col.key} value={col.key}>
                {col.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export function CsvUploadSheet({
  open,
  onOpenChange,
  wallets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Account[];
}) {
  const t = useTranslations("imports");
  const qc = useQueryClient();

  const walletOptions = wallets.filter((w) => w.type !== "debt");
  const [selectedWalletId, setSelectedWalletId] = useState(walletOptions[0]?.id ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportFilePreview | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMapping | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveWalletId = selectedWalletId || walletOptions[0]?.id || "";
  const selectedWallet = walletOptions.find((w) => w.id === effectiveWalletId);
  const selectedWalletName = selectedWallet
    ? `${selectedWallet.name} · ${selectedWallet.currency}`
    : t("upload.fields.walletPlaceholder");

  const previewMutation = useMutation({
    mutationFn: fetchImportPreviewRequest,
    onSuccess: (p) => {
      setPreview(p);
      setMapping(p.suggestedMapping);
      setError(null);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveWalletId) throw new Error(t("upload.walletRequired"));
      if (!selectedFile || !mapping) throw new Error(t("upload.fileRequired"));
      return uploadMappedImportRequest({ walletId: effectiveWalletId, file: selectedFile, mapping });
    },
    onSuccess: (snapshot) => {
      qc.setQueryData(bankingSnapshotQueryKey, snapshot);
      // Reset form and close
      setSelectedFile(null);
      setPreview(null);
      setMapping(null);
      setShowAdvanced(false);
      setShowPreview(false);
      setError(null);
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("feedback.uploadFailed"));
    },
  });

  async function handleFilePicked(file: File | null) {
    if (!file) return;
    setSelectedFile(file);
    setDragActive(false);
    setError(null);
    setShowAdvanced(false);
    setShowPreview(false);
    try {
      await previewMutation.mutateAsync(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("feedback.uploadFailed"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 px-5 py-4">
          <SheetTitle>{t("upload.title")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Dropzone */}
          <div
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragActive ? "border-foreground/40 bg-muted/30" : "border-border bg-background/70"
            }`}
            onClick={() => document.getElementById("csv-file-sheet")?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void handleFilePicked(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <div className="mx-auto flex max-w-[220px] flex-col items-center gap-3">
              <div className="rounded-full border border-border/70 bg-muted/20 p-3">
                <FileUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {selectedFile ? selectedFile.name : t("upload.dropzone.title")}
                </p>
                {!selectedFile && (
                  <p className="text-xs text-muted-foreground">{t("upload.dropzone.description")}</p>
                )}
              </div>
              <Input
                id="csv-file-sheet"
                type="file"
                accept=".csv,.tsv,.xlsx,.xls,text/csv"
                className="hidden"
                onChange={(e) => void handleFilePicked(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {/* Wallet picker */}
          {walletOptions.length > 0 && (
            <Field>
              <FieldLabel>{t("upload.fields.wallet")}</FieldLabel>
              <Select
                value={effectiveWalletId}
                onValueChange={(v) => setSelectedWalletId(v ?? "")}
              >
                <SelectTrigger size="sm" className="w-full rounded-[10px] bg-background shadow-none">
                  <SelectValue>{selectedWalletName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {walletOptions.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} · {w.currency}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Column mapping */}
          {preview && mapping && (
            <div className="space-y-4 border-t border-border/70 pt-4">
              <div className="space-y-3">
                {BASIC_FIELDS.map((field) => (
                  <MappingField
                    key={field.key}
                    field={field}
                    mapping={mapping}
                    preview={preview}
                    t={t}
                    onChange={(key, value) =>
                      setMapping((cur) => (cur ? { ...cur, [key]: value } : cur))
                    }
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {showAdvanced ? t("mapping.lessFields") : t("mapping.moreFields")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPreview ? t("mapping.hidePreview") : t("mapping.showPreview")}
                </Button>
              </div>

              {showAdvanced && (
                <div className="space-y-3 border-t border-border/70 pt-3">
                  {ADVANCED_FIELDS.map((field) => (
                    <MappingField
                      key={field.key}
                      field={field}
                      mapping={mapping}
                      preview={preview}
                      t={t}
                      onChange={(key, value) =>
                        setMapping((cur) => (cur ? { ...cur, [key]: value } : cur))
                      }
                    />
                  ))}
                </div>
              )}

              {showPreview && (
                <div className="overflow-auto rounded-xl border border-border/70 bg-background/70 text-xs">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-border/70 bg-muted/20">
                      <tr>
                        {preview.columns.map((col) => (
                          <th key={col.key} className="px-3 py-2 font-medium">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.rowIndex} className="border-b border-border/50 last:border-0">
                          {row.values.map((val, i) => (
                            <td key={i} className="max-w-[140px] truncate px-3 py-1.5 text-muted-foreground">
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="shrink-0 border-t border-border/70 px-5 py-4">
          <Button
            type="button"
            className="w-full gap-2"
            disabled={
              uploadMutation.isPending ||
              !selectedFile ||
              !mapping ||
              !canImport(mapping)
            }
            onClick={() => void uploadMutation.mutateAsync()}
          >
            <FileUp className="h-4 w-4" />
            {uploadMutation.isPending ? t("upload.pending") : t("upload.action")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
