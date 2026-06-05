import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { BillingSettings } from "./billing-settings";
import { StoryDemoFrame } from "@/stories/fixtures/story-data";
import type { BillingEntitlement } from "@/lib/billing/access";

const meta = {
  title: "Features/Settings/BillingSettings",
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-2xl">
        <Story />
      </StoryDemoFrame>
    ),
  ],
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function entitlement(values: Partial<BillingEntitlement>): BillingEntitlement {
  return {
    user_id: "user-1",
    stripe_customer_id: "cus_story",
    stripe_subscription_id: "sub_story",
    subscription_status: "active",
    trial_end: null,
    current_period_end: "2026-07-05T12:00:00.000Z",
    cancel_at_period_end: false,
    access_override: null,
    ...values,
  };
}

export const Trialing: Story = {
  render: () =>
    <BillingSettings
      entitlement={entitlement({
        subscription_status: "trialing",
        trial_end: "2026-07-05T12:00:00.000Z",
      })}
    />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Subscription")).toBeInTheDocument();
    await expect(canvas.getByText("Trial")).toBeInTheDocument();
  },
};

export const Active: Story = {
  render: () => <BillingSettings entitlement={entitlement({})} />,
};

export const Canceling: Story = {
  render: () =>
    <BillingSettings
      entitlement={entitlement({
        cancel_at_period_end: true,
      })}
    />,
};

export const Blocked: Story = {
  render: () => <BillingSettings entitlement={null} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Read-only")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Start trial" })).toBeInTheDocument();
  },
};

export const AlwaysPaid: Story = {
  render: () =>
    <BillingSettings
      entitlement={entitlement({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        access_override: "always_paid",
      })}
    />,
};
