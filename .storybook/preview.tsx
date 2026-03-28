import type { Preview } from "@storybook/nextjs-vite";

import { AppProviders } from "@/components/providers/app-providers";

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
        order: ["Atoms", "Molecules", "Organisms", "Templates", "Pages"],
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
        <div
          style={
            {
              minHeight: "100vh",
              background: "#ece8e4",
              color: "#0f172a",
              ["--font-inter" as string]:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              ["--font-jetbrains-mono" as string]:
                '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            } as React.CSSProperties
          }
        >
          <Story />
        </div>
      </AppProviders>
    ),
  ],
};

export default preview;
