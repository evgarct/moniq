"use client";

import { usePathname } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Button } from "@/components/ui/button";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/calendar": "Calendar",
  "/today": "Today",
  "/accounts": "Balance",
};

export function AppHeader({
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Moniq";

  return (
    <header className="sticky top-0 z-20 border-b border-white/12 bg-[#203847] text-slate-50">
      <div className="grid h-[52px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        <div className="justify-self-start text-[13px] font-medium text-slate-100">Edit</div>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]">{title}</h1>
        <div className="flex items-center justify-self-end">
          <Button variant="ghost" size="icon-sm" className="text-slate-200 hover:bg-white/5 hover:text-white">
            <Download className="h-4 w-4" />
            <span className="sr-only">Export</span>
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-slate-200 hover:bg-white/5 hover:text-white">
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-slate-200 hover:bg-white/5 hover:text-white">
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add</span>
          </Button>
          <LogoutButton
            action={onSignOut}
            variant="ghost"
            size="icon-sm"
            className="ml-1 text-slate-200 hover:bg-white/5 hover:text-white"
            label=""
          />
        </div>
      </div>
    </header>
  );
}
