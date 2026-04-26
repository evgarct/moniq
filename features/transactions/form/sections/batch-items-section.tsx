"use client";

import { Plus } from "lucide-react";
import { Controller, useFormContext, type FieldError } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { Button } from "@/components/ui/button";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { DecimalInput, FieldMessage, SplitRow, PickerRow } from "../primitives";
import type { TransactionFormInputs } from "../types";

export function BatchItemsSection() {
  const t = useTranslations("transactions.form");
  const commonT = useTranslations("common.actions");

  const {
    form,
    kind,
    accounts,
    categoryOptions,
    primaryCurrencySymbol,
    fields,
    insert,
    remove,
    appendLineItem,
    lineMenu,
    setLineMenu,
    lineMenuRef,
    amountInputRefs,
    lineTriggerRefs,
  } = useTransactionFormContext();

  const { control, formState: { errors } } = useFormContext<TransactionFormInputs>();
  const lineItems = useFormContext<TransactionFormInputs>().watch("line_items");
  const totalAmount = (lineItems ?? []).reduce((sum, item) => sum + (item?.amount ?? 0), 0);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openMenu = (index: number, x: number, y: number) => setLineMenu({ index, x, y });

  return (
    <>
      {/* Account picker at top */}
      <PickerRow className="border-b-0 pt-4">
        {kind === "income" ? (
          <AccountSelect
            name="destination_account_id"
            accounts={accounts}
            placeholder={t("placeholders.destinationAccount")}
          />
        ) : (
          <AccountSelect
            name="source_account_id"
            accounts={accounts}
            placeholder={t("placeholders.sourceAccount")}
          />
        )}
      </PickerRow>

      {/* Line items */}
      {fields.map((field, index) => (
        <SplitRow
          key={field.id}
          rowClassName="min-h-0 py-0"
          onContextMenu={(event) => {
            event.preventDefault();
            openMenu(index, event.clientX, event.clientY);
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") return;
            clearLongPress();
            longPressTimerRef.current = setTimeout(() => {
              openMenu(index, event.clientX, event.clientY);
            }, 450);
          }}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
          left={
            <Controller
              control={control}
              name={`line_items.${index}.category_id`}
              render={({ field: itemField }) => (
                <CategoryCascadePicker
                  categories={categoryOptions}
                  value={itemField.value}
                  onSelect={(value) => {
                    itemField.onChange(value);
                    setTimeout(() => amountInputRefs.current[index]?.focus(), 0);
                  }}
                  placeholder={t("placeholders.category")}
                  triggerClassName="h-auto border-0 bg-transparent px-0 py-0 text-left text-sm leading-5 shadow-none outline-none hover:bg-transparent"
                  contentClassName="min-w-[16rem]"
                />
              )}
            />
          }
          right={
            <Controller
              control={control}
              name={`line_items.${index}.amount`}
              render={({ field: itemField }) => (
                <div className="flex items-center justify-end gap-2">
                  <DecimalInput
                    id={`transaction-line-amount-${index}`}
                    ref={(node) => {
                      amountInputRefs.current[index] = node;
                    }}
                    className="h-7 w-[5.25rem] rounded-none border-0 bg-transparent px-0 py-0.5 text-right text-base leading-6 font-medium tabular-nums shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
                    hidePlaceholderOnFocus
                    placeholder="0.00"
                    value={itemField.value ?? null}
                    onValueChange={itemField.onChange}
                  />
                  <span className="text-sm text-foreground">{primaryCurrencySymbol}</span>
                </div>
              )}
            />
          }
        >
          <FieldMessage error={errors.line_items?.[index]?.category_id as FieldError | undefined} />
          <FieldMessage error={errors.line_items?.[index]?.amount as FieldError | undefined} />
        </SplitRow>
      ))}

      {/* Add row + total */}
      <SplitRow
        rowClassName="min-h-6 py-0 -mt-1"
        left={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 justify-start gap-2 border-0 px-2 text-foreground shadow-none hover:bg-accent/40 hover:text-foreground focus-visible:ring-0"
            onClick={appendLineItem}
          >
            <Plus data-icon="inline-start" />
            {commonT("add")}
          </Button>
        }
        right={
          fields.length > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm font-semibold tabular-nums">
              <span>{totalAmount.toFixed(2)}</span>
              <span className="text-sm font-semibold text-foreground">{primaryCurrencySymbol}</span>
            </div>
          ) : (
            <span className="text-sm text-transparent">0.00</span>
          )
        }
      />

      <FieldMessage error={errors.line_items as FieldError | undefined} />

      {/* Context menu */}
      {lineMenu ? (
        <div
          ref={lineMenuRef}
          className="fixed z-50 min-w-36 rounded-[var(--radius-floating)] bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={{ left: lineMenu.x, top: lineMenu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center rounded-[var(--radius-control)] px-2 py-1.5 text-left hover:bg-accent"
            onClick={() => {
              const line = form.getValues(`line_items.${lineMenu.index}`);
              insert(lineMenu.index + 1, { ...line });
              setLineMenu(null);
            }}
          >
            {commonT("duplicate")}
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-[var(--radius-control)] px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
            onClick={() => {
              remove(lineMenu.index);
              setLineMenu(null);
            }}
          >
            {commonT("delete")}
          </button>
        </div>
      ) : null}
    </>
  );
}
