"use client";

import { usePathname } from "next/navigation";
import { Bell, MessageSquare, Search } from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/calendar": "Calendar",
  "/today": "Today",
  "/accounts": "Organization Settings",
};

export function AppHeader({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  void onSignOut;
  const pathname = usePathname();
  const title = titles[pathname] ?? "Moniq";

  return (
    <header className="border-b border-black/5 bg-white/70">
      <PageContainer className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-black/5 bg-white px-3 py-1.5 text-[12px] text-slate-500">
            <Search className="mr-1.5 inline h-3.5 w-3.5" />
            Search
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-3 py-1.5 text-[12px] text-slate-700">
            Create Job
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-3 py-1.5 text-[12px] text-slate-700">
            {title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-black/5 bg-white px-2.5 py-1.5 md:flex">
            <span className="text-[11px] text-slate-400">Talk to AI...</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <Button variant="ghost" size="icon-sm" className="rounded-xl bg-white text-slate-600 hover:bg-slate-100">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="rounded-xl bg-white text-slate-600 hover:bg-slate-100">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
            {user.email?.slice(0, 1).toUpperCase() ?? "M"}
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
