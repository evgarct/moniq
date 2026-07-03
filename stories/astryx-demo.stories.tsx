import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { useTranslations } from "next-intl";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";

import { StoryDemoFrame } from "@/stories/fixtures/story-data";

function AstryxDemoComponent() {
  const t = useTranslations("designSystem.astryxDemo");

  return (
    <VStack gap={6} className="w-full max-w-[480px]">
      <VStack gap={2}>
        <Heading level={1} data-testid="astryx-heading">
          {t("title")}
        </Heading>
        <Text type="supporting" color="secondary">
          {t("description")}
        </Text>
      </VStack>

      <VStack gap={4} className="bg-card p-4 rounded-surface">
        <Heading level={3}>
          {t("heading")}
        </Heading>
        <Text type="body">
          {t("body")}
        </Text>

        <HStack gap={3} align="start">
          <Button 
            label={t("buttonLabel")} 
            variant="primary" 
            onClick={() => alert("Primary clicked")} 
          />
          <Button 
            label="Secondary" 
            variant="secondary" 
            onClick={() => alert("Secondary clicked")} 
          />
          <Button 
            label="Ghost" 
            variant="ghost" 
            onClick={() => alert("Ghost clicked")} 
          />
        </HStack>
      </VStack>

      <Text type="supporting" color="secondary" className="text-center">
        {t("themeLabel")}
      </Text>
    </VStack>
  );
}

const meta = {
  title: "Foundations/Astryx Demo",
  component: AstryxDemoComponent,
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-[520px]">
        <Story />
      </StoryDemoFrame>
    ),
  ],
} satisfies Meta<typeof AstryxDemoComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
