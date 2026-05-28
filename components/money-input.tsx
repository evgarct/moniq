"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  formatMoneyInputValue,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "@/lib/money-input";

export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
    blankZeroOnFocus?: boolean;
    selectOnFocus?: boolean;
    value: number | null | undefined;
    onValueChange: (value: number | null) => void;
  }
>(function MoneyInput(
  {
    value,
    onValueChange,
    inputMode = "decimal",
    blankZeroOnFocus = false,
    selectOnFocus = false,
    ...props
  },
  ref,
) {
  const [draft, setDraft] = React.useState(formatMoneyInputValue(value));
  const [isFocused, setIsFocused] = React.useState(false);
  const displayValue = isFocused ? draft : formatMoneyInputValue(value);

  React.useEffect(() => {
    if (!isFocused) {
      setDraft(formatMoneyInputValue(value));
    }
  }, [isFocused, value]);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode}
      value={displayValue}
      onFocus={(event) => {
        const input = event.currentTarget;
        const nextDraft = blankZeroOnFocus && value === 0 ? "" : formatMoneyInputValue(value);
        setDraft(nextDraft);
        setIsFocused(true);

        if (selectOnFocus && nextDraft) {
          window.requestAnimationFrame(() => input.select());
        }

        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        setDraft(sanitizeMoneyInput(event.currentTarget.value));
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        const sanitized = sanitizeMoneyInput(event.currentTarget.value);
        setDraft(sanitized);

        if (sanitized === ".") {
          return;
        }

        onValueChange(parseMoneyInput(sanitized));
      }}
    />
  );
});
