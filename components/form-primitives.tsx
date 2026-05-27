"use client";

import * as React from "react";
import { format, isSameYear, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { FieldError } from "react-hook-form";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FieldErrorLike = Pick<FieldError, "message"> | undefined;

export function FieldMessage({
  error,
  className,
}: {
  error?: FieldErrorLike;
  className?: string;
}) {
  if (!error?.message) return null;
  return <p className={cn("mt-0.5 text-xs text-destructive", className)}>{error.message}</p>;
}

export function FormSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("flex flex-col gap-2", className)}>{children}</section>;
}

export function FormPickerRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("min-h-11 border-b border-border/70 py-2", className)}>{children}</div>;
}

export function FormRow({
  label,
  children,
  className,
  labelClassName,
  contentClassName,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        label
          ? "grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1"
          : "min-h-10 py-1",
        className,
      )}
    >
      {label ? <div className={cn("min-w-0 text-sm text-foreground", labelClassName)}>{label}</div> : null}
      <div className={cn(label ? "flex min-w-0 items-center justify-end gap-2" : "min-w-0", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function FormSplitRow({
  left,
  right,
  trailing,
  children,
  align = "center",
  rowClassName,
  className,
  childrenClassName,
  ...props
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  align?: "center" | "start";
  rowClassName?: string;
  childrenClassName?: string;
} & React.ComponentProps<"div">) {
  return (
    <div className={cn("relative min-h-10 py-1.5", rowClassName)} {...props}>
      <div
        className={cn(
          "grid gap-3",
          trailing ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
          align === "start" ? "items-start" : "items-center",
          className,
        )}
      >
        <div className="min-w-0">{left}</div>
        {right ? <div className="min-w-0">{right}</div> : null}
        {trailing ? <div className="flex items-center justify-end">{trailing}</div> : null}
      </div>
      {children ? <div className={cn("mt-1 flex flex-col gap-1", childrenClassName)}>{children}</div> : null}
    </div>
  );
}

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
  const [draft, setDraft] = React.useState(value == null ? "" : String(value));
  const [isFocused, setIsFocused] = React.useState(false);
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
        if (!sanitized) {
          onValueChange(null);
          return;
        }
        if (sanitized === ".") return;
        const parsed = Number(sanitized);
        if (!Number.isNaN(parsed)) onValueChange(parsed);
      }}
    />
  );
});

function formatFormDate(value: string) {
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
        <span>{formatFormDate(value)}</span>
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
