import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { AuthForm } from "@/features/auth/components/auth-form";
import { BrandLogin } from "@/features/auth/components/brand-login";

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
} satisfies Meta<typeof AuthForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Login: Story = {
  parameters: { layout: "fullscreen" },
  decorators: [
    (_, { args }) => (
      <BrandLogin>
        <AuthForm {...args} />
      </BrandLogin>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Email"), "demo@moniq.app");
    await expect(canvas.getByDisplayValue("demo@moniq.app")).toBeInTheDocument();
  },
};

export const LoginWithDarkPreference: Story = {
  ...Login,
  parameters: { ...Login.parameters, themes: { themeOverride: "dark" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const registration = canvas.getByRole("link", { name: /sign up/i });
    await expect(registration).toHaveStyle({ color: "rgb(25, 25, 25)" });
  },
};

export const Signup: Story = {
  args: {
    mode: "signup",
  },
  decorators: [
    (Story) => (
      <section className="flex min-h-screen items-center justify-center bg-muted p-8">
        <Story />
      </section>
    ),
  ],
};
