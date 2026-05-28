import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useTranslations } from "next-intl";

import { DetailField, DetailFieldGrid } from "@/components/detail-field";
import { StoryDemoFrame } from "@/stories/fixtures/story-data";

function DetailFieldDemo() {
  const t = useTranslations("designSystem.detailField");

  return (
    <DetailFieldGrid>
      <DetailField label={t("dateLabel")}>{t("dateValue")}</DetailField>
      <DetailField label={t("amountLabel")}>{t("amountValue")}</DetailField>
      <DetailField label={t("walletLabel")} className="sm:col-span-2">
        {t("walletValue")}
      </DetailField>
    </DetailFieldGrid>
  );
}

const meta = {
  title: "Atoms/DetailField",
  component: DetailField,
  args: {
    label: "Date",
    children: "Apr 12, 2026",
  },
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-[420px]">
        <Story />
      </StoryDemoFrame>
    ),
  ],
  render: () => <DetailFieldDemo />,
} satisfies Meta<typeof DetailField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
