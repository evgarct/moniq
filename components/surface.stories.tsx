import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Surface } from "@/components/surface";

const meta = {
  title: "Atoms/Surface",
  component: Surface,
  args: {
    tone: "panel",
    padding: "lg",
    children: (
      <div className="space-y-1">
        <p className="text-sm text-slate-500">Surface label</p>
        <p className="text-base font-medium text-slate-900">Reusable finance shell</p>
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[360px] bg-[#fbf8f4] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Surface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Panel: Story = {};

export const Canvas: Story = {
  args: {
    tone: "canvas",
  },
};

export const Floating: Story = {
  args: {
    tone: "floating",
  },
};
