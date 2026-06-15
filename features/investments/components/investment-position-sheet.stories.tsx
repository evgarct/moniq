import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { InvestmentPositionSheet } from "@/features/investments/components/investment-position-sheet";

const meta = {
  title: "Organisms/InvestmentPositionSheet",
  component: InvestmentPositionSheet,
  args: {
    open: true,
    onOpenChange: () => undefined,
    onSubmit: () => undefined,
    initialInstruments: [],
  },
} satisfies Meta<typeof InvestmentPositionSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchForm: Story = {};
