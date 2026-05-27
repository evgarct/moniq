"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useTranslations } from "next-intl";

import {
  DecimalInput,
  FieldMessage,
  FlatDatePicker,
  FormPickerRow,
  FormRow,
  FormSection,
  FormSplitRow,
} from "@/components/form-primitives";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/surface";

function FormPrimitivesDemo() {
  const t = useTranslations("designSystem.formPrimitives");
  const [amount, setAmount] = useState<number | null>(1250);
  const [date, setDate] = useState("2026-05-27");

  return (
    <Surface tone="panel" padding="lg" className="mx-auto max-w-xl border border-black/5">
      <FormSection className="gap-4">
        <div className="flex flex-col gap-1 px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h2 className="type-h3">{t("title")}</h2>
          <p className="type-body-14 text-muted-foreground">{t("description")}</p>
        </div>

        <FormPickerRow className="pt-4">
          <Input
            aria-label={t("pickerLabel")}
            className="h-10 w-full rounded-none border-0 bg-transparent px-0 py-1 text-base leading-7 shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
            placeholder={t("pickerPlaceholder")}
          />
        </FormPickerRow>

        <FormRow label={t("amount")}>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center justify-end gap-2">
              <DecimalInput
                aria-label={t("amount")}
                className="h-8 w-[11rem] rounded-none border-0 bg-transparent px-0 py-1 text-right text-base leading-6 font-medium shadow-none"
                hidePlaceholderOnFocus
                value={amount}
                onValueChange={setAmount}
              />
              <span className="text-sm text-foreground">{t("currency")}</span>
            </div>
            <FieldMessage error={{ message: t("amountError") }} />
          </div>
        </FormRow>

        <FormSplitRow
          left={<FlatDatePicker value={date} onChange={setDate} />}
          right={<span className="text-sm text-muted-foreground">{t("paid")}</span>}
        >
          <FieldMessage error={undefined} />
        </FormSplitRow>
      </FormSection>
    </Surface>
  );
}

const meta = {
  title: "Molecules/FormPrimitives",
  parameters: {
    layout: "fullscreen",
  },
  render: () => (
    <div className="min-h-screen bg-background p-6">
      <FormPrimitivesDemo />
    </div>
  ),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
