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
    <div className="min-h-screen w-full overflow-x-hidden bg-[#ece8e4]">
      <div className="min-h-screen w-full lg:grid lg:grid-cols-[76px_minmax(0,1fr)]">
        <AppSidebar user={storyUser} onSignOut={noopAsyncAction} />
        <div className="min-w-0 bg-[#fbf8f4]">
          <main className="min-h-screen overflow-x-hidden pb-[64px] lg:pb-0">
            <div data-pathname={pathname} className="min-h-screen">
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
