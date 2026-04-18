"use client";

import React, { useState } from "react";
import { format, isSameYear, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { FieldError } from "react-hook-form";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── Layout primitives ───────────────────────────────────────────────────────

export function FieldMessage({ error }: { error?: FieldError }) {
  if (!error?.message) return null;
  return <p className="text-xs text-destructive mt-0.5">{error.message}</p>;
}

export function FormBlock({ children }: { children: React.ReactNode }) {
  return <section className="space-y-2">{children}</section>;
}

export function PickerRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-11 border-b border-border/70 py-2", className)}>{children}</div>;
}

export function RowShell({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div
      className={
        label
          ? "grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1"
          : "min-h-10 py-1"
      }
    >
      {label ? <div className="min-w-0 text-sm text-foreground">{label}</div> : null}
      <div className={label ? "min-w-0 flex items-center justify-end gap-2" : "min-w-0"}>{children}</div>
    </div>
  );
}

export function SplitRow({
  left,
  right,
  trailing,
  children,
  align = "center",
  rowClassName,
  className,
  ...props
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  align?: "center" | "start";
  rowClassName?: string;
} & React.ComponentProps<"div">) {
  return (
    <div className={cn("relative min-h-10 py-1.5", rowClassName)} {...props}>
      <div
        className={`${className ?? ""} grid gap-3 ${trailing ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]"} ${
          align === "start" ? "items-start" : "items-center"
        }`}
      >
        <div className="min-w-0">{left}</div>
        {right ? <div className="min-w-0">{right}</div> : null}
        {trailing ? <div className="flex items-center justify-end">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-1 space-y-1">{children}</div> : null}
    </div>
  );
}

// ─── DecimalInput ─────────────────────────────────────────────────────────────

function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [integerPart = "", ...fractionParts] = normalized.split(".");
  return fractionParts.length > 0 ? `${integerPart}.${fractionParts.join("")}` : integerPart;
}

export const DecimalInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
    hidePlaceholderOnFocus?: boolean;
    value: number | null | undefined;
    onValueChange: (value: number | null) => void;
  }
>(function DecimalInput(
  { value, onValueChange, inputMode = "decimal", hidePlaceholderOnFocus = false, ...props },
  ref,
) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [isFocused, setIsFocused] = useState(false);
  const displayValue = isFocused ? draft : value == null ? "" : String(value);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode}
      placeholder={hidePlaceholderOnFocus && isFocused ? "" : props.placeholder}
      value={displayValue}
      onFocus={(event) => {
        setDraft(value == null ? "" : String(value));
        setIsFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        const sanitized = sanitizeDecimalInput(event.target.value);
        setDraft(sanitized);
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        const sanitized = sanitizeDecimalInput(event.target.value);
        setDraft(sanitized);
        if (!sanitized) { onValueChange(null); return; }
        if (sanitized === ".") return;
        const parsed = Number(sanitized);
        if (!Number.isNaN(parsed)) onValueChange(parsed);
      }}
    />
  );
});

// ─── FlatDatePicker ───────────────────────────────────────────────────────────

function formatTransactionDate(value: string) {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, isSameYear(parsed, new Date()) ? "d MMM" : "d MMM yyyy");
}

export function FlatDatePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex min-h-8 items-center gap-2 border-0 bg-transparent px-0 py-0 text-sm font-normal text-foreground outline-none focus:outline-none focus-visible:ring-0",
          className,
        )}
      >
        <CalendarIcon className="size-4 opacity-70" />
        <span>{formatTransactionDate(value)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
