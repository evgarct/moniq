import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Surface } from "@/components/surface";
import { StoryDemoFrame } from "@/stories/fixtures/story-data";

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
      <StoryDemoFrame width="max-w-[360px]">
        <Story />
      </StoryDemoFrame>
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
