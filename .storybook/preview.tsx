import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import { AppProviders } from "@/components/providers/app-providers";
import messages from "@/messages/en.json";

import "../app/globals.css";

const preview: Preview = {
  tags: ["autodocs", "test"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ["Foundations", "Atoms", "Molecules", "Organisms", "Templates", "Pages"],
      },
    },
    backgrounds: {
      default: "workspace",
      values: [
        { name: "workspace", value: "#ece8e4" },
        { name: "panel", value: "#fbf8f4" },
        { name: "white", value: "#ffffff" },
      ],
    },
  },
  decorators: [
    (Story) => (
      <AppProviders>
        <NextIntlClientProvider locale="en" messages={messages}>
          <div
            className="min-h-screen bg-[#ece8e4] font-sans text-slate-900"
            style={
              {
                ["--font-inter" as string]:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                ["--font-jetbrains-mono" as string]:
                  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                ["--font-heading" as string]:
                  '"PT Serif", Georgia, Cambria, "Times New Roman", serif',
              } as React.CSSProperties
            }
          >
            <Story />
          </div>
        </NextIntlClientProvider>
      </AppProviders>
    ),
  ],
};

export default preview;
