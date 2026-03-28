"use client";

import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/calendar": "Calendar",
  "/today": "Today",
  "/accounts": "Accounts",
};

export function AppHeader({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Moniq";

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <PageContainer className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]">{title}</h1>
          <p className="text-[12px] text-muted-foreground">Dense finance workspace with mock operational data.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search" className="h-8 rounded-sm border-transparent bg-muted/70 pl-8 shadow-none" />
          </div>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
          <div className="hidden items-center justify-between gap-3 border-l pl-3 sm:flex sm:min-w-48">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium">{user.email}</p>
              <p className="text-[11px] text-muted-foreground">Authenticated session</p>
            </div>
            <LogoutButton action={onSignOut} variant="ghost" size="sm" label="Logout" />
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
