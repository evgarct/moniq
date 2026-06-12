import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AppSidebar } from "@/components/app-sidebar";
import { mockFinanceSnapshot } from "@/lib/mock-finance";
import type { AuthUser } from "@/types/auth";
import type { FinanceSnapshot } from "@/types/finance";

export function makeFinanceSnapshot(): FinanceSnapshot {
  return JSON.parse(JSON.stringify(mockFinanceSnapshot)) as FinanceSnapshot;
}

export const storyUser: AuthUser = {
  id: "storybook-user",
  aud: "authenticated",
  email: "demo@moniq.app",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};

export const noopAsyncAction = async () => {};

export function StoryWorkspace({
  pathname,
  children,
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface-base pt-2 lg:pt-0">
      <div className="min-h-0 w-full flex-1 overflow-hidden lg:grid lg:grid-cols-[76px_minmax(0,1fr)]">
        <AppSidebar user={storyUser} onSignOut={noopAsyncAction} />
        <div className="app-workspace-frame">
          <main className="h-full overflow-hidden">
            <div data-pathname={pathname} className="h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function withPathname(pathname: string) {
  return {
    nextjs: {
      navigation: {
        pathname,
      },
    },
  };
}

export function StoryDemoFrame({
  children,
  width = "max-w-4xl",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  return <div className={`${width} rounded-xl bg-white p-4`}>{children}</div>;
}

export async function expectHeading(canvasElement: HTMLElement, text: string) {
  const canvas = within(canvasElement);
  await expect(canvas.getByText(text)).toBeInTheDocument();
}

export type Story<T extends Meta> = StoryObj<T>;
