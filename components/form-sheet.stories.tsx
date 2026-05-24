import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormSelectField,
  FormSheet,
  FormSheetBody,
} from "@/components/form-sheet";
import { Input } from "@/components/ui/input";
import { SelectGroup, SelectItem } from "@/components/ui/select";

function BasicFormSheetDemo() {
  const t = useTranslations("designSystem.formSheets.basic");

  return (
    <FormSheet
      open
      onOpenChange={fn()}
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onSubmit={(event) => event.preventDefault()}
    >
      <FormSheetBody>
        <FormField id="form-sheet-basic-name" label={t("name")}>
          <Input id="form-sheet-basic-name" placeholder={t("namePlaceholder")} />
        </FormField>
      </FormSheetBody>
    </FormSheet>
  );
}

function ErrorFormSheetDemo() {
  const t = useTranslations("designSystem.formSheets.error");

  return (
    <FormSheet
      open
      onOpenChange={fn()}
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onSubmit={(event) => event.preventDefault()}
    >
      <FormSheetBody>
        <FormField id="form-sheet-error-name" label={t("name")} error={{ message: t("message") }}>
          <Input id="form-sheet-error-name" aria-invalid />
        </FormField>
      </FormSheetBody>
    </FormSheet>
  );
}

function SelectFormSheetDemo() {
  const t = useTranslations("designSystem.formSheets.select");
  const [type, setType] = useState("cash");

  return (
    <FormSheet
      open
      onOpenChange={fn()}
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onSubmit={(event) => event.preventDefault()}
    >
      <FormSheetBody>
        <FormSelectField
          id="form-sheet-select-type"
          label={t("type")}
          value={type}
          onValueChange={setType}
        >
          <SelectGroup>
            <SelectItem value="cash">{t("cash")}</SelectItem>
            <SelectItem value="saving">{t("saving")}</SelectItem>
            <SelectItem value="credit">{t("credit")}</SelectItem>
          </SelectGroup>
        </FormSelectField>
      </FormSheetBody>
    </FormSheet>
  );
}

function ConditionalFormSheetDemo() {
  const t = useTranslations("designSystem.formSheets.conditional");
  const [showTarget, setShowTarget] = useState(true);

  return (
    <FormSheet
      open
      onOpenChange={fn()}
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onSubmit={(event) => event.preventDefault()}
    >
      <FormSheetBody>
        <FormSelectField
          id="form-sheet-conditional-enabled"
          label={t("enabled")}
          value={showTarget ? "yes" : "no"}
          onValueChange={(value) => setShowTarget(value === "yes")}
        >
          <SelectGroup>
            <SelectItem value="yes">{t("enabled")}</SelectItem>
            <SelectItem value="no">{t("disabled")}</SelectItem>
          </SelectGroup>
        </FormSelectField>
        {showTarget ? (
          <FormField id="form-sheet-conditional-amount" label={t("amount")}>
            <Input id="form-sheet-conditional-amount" type="number" min="0" />
          </FormField>
        ) : null}
      </FormSheetBody>
    </FormSheet>
  );
}

const meta = {
  title: "Molecules/FormSheet",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => <BasicFormSheetDemo />,
};

export const WithError: Story = {
  render: () => <ErrorFormSheetDemo />,
};

export const SelectField: Story = {
  render: () => <SelectFormSheetDemo />,
};

export const ConditionalField: Story = {
  render: () => <ConditionalFormSheetDemo />,
};
