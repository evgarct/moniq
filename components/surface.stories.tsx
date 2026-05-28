import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Surface, SurfaceDescription, SurfaceEyebrow, SurfaceHeader, SurfaceTitle } from "@/components/surface";
import { StoryDemoFrame } from "@/stories/fixtures/story-data";

function SurfaceDemo({ tone, padding }: Pick<ComponentProps<typeof Surface>, "tone" | "padding">) {
  const t = useTranslations("designSystem.surface");

  return (
    <Surface tone={tone} padding={padding}>
      <SurfaceHeader action={<Button size="sm">{t("action")}</Button>}>
        <div className="flex flex-col gap-1">
          <SurfaceEyebrow>{t("eyebrow")}</SurfaceEyebrow>
          <SurfaceTitle>{t("title")}</SurfaceTitle>
          <SurfaceDescription>{t("description")}</SurfaceDescription>
        </div>
      </SurfaceHeader>
    </Surface>
  );
}

const meta = {
  title: "Atoms/Surface",
  component: Surface,
  args: {
    tone: "panel",
    padding: "lg",
    children: null,
  },
  render: (args) => <SurfaceDemo tone={args.tone} padding={args.padding} />,
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
