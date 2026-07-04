import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import { AppProviders } from "@/components/providers/app-providers";
import messages from "@/messages/en.json";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

import "../app/globals.css";
import "@astryxdesign/theme-neutral/theme.css";

const preview: Preview = {
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    nextjs: {
      appDirectory: true,
    },
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ["Foundations", "Atoms", "Molecules", "Organisms", "Features", "Templates", "Pages"],
      },
    },
    backgrounds: {
      default: "white",
      values: [
        { name: "workspace", value: "#ece8e4" },
        { name: "panel", value: "#fbf8f4" },
        { name: "white", value: "#ffffff" },
      ],
    },
  },
  decorators: [
    (Story) => (
      <Theme theme={neutralTheme} mode="light">
        <AppProviders>
          <NextIntlClientProvider locale="en" messages={messages} timeZone="Europe/Prague">
            <div>
              <style>
                {`
                  html,
                  body,
                  #storybook-root,
                  #root {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: auto !important;
                  }
                `}
              </style>
              <div
                className="font-sans text-slate-900"
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
            </div>
          </NextIntlClientProvider>
        </AppProviders>
      </Theme>
    ),
  ],
};

export default preview;
