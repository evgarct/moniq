import type { Preview } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import { AppProviders } from "@/components/providers/app-providers";
import messages from "@/messages/en.json";

import "../app/globals.css";

function StorybookViewport({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyHeight = document.body.style.height;
    const previousBodyMinHeight = document.body.style.minHeight;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlHeight = document.documentElement.style.height;

    document.body.style.overflowY = "scroll";
    document.body.style.overflowX = "hidden";
    document.body.style.height = "auto";
    document.body.style.minHeight = "100vh";
    document.documentElement.style.overflowY = "scroll";
    document.documentElement.style.overflowX = "hidden";
    document.documentElement.style.height = "auto";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowY = "";
      document.body.style.overflowX = "";
      document.body.style.height = previousBodyHeight;
      document.body.style.minHeight = previousBodyMinHeight;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overflowY = "";
      document.documentElement.style.overflowX = "";
      document.documentElement.style.height = previousHtmlHeight;
    };
  }, []);

  return <>{children}</>;
}

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
      <StorybookViewport>
        <AppProviders>
          <NextIntlClientProvider locale="en" messages={messages} timeZone="Europe/Prague">
            <div
              className="min-h-screen overflow-y-scroll overflow-x-hidden bg-[#ece8e4] font-sans text-slate-900"
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
      </StorybookViewport>
    ),
  ],
};

export default preview;
