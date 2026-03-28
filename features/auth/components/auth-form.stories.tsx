import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { AuthForm } from "@/features/auth/components/auth-form";

async function mockAuthAction() {
  return {
    values: {
      email: "",
    },
  };
}

const meta = {
  title: "Organisms/AuthForm",
  component: AuthForm,
  args: {
    mode: "login",
    action: mockAuthAction,
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen items-center justify-center bg-[#ece8e4] p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Login: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Email"), "demo@moniq.app");
    await expect(canvas.getByDisplayValue("demo@moniq.app")).toBeInTheDocument();
  },
};

export const Signup: Story = {
  args: {
    mode: "signup",
  },
};
