"use client";

import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/calendar": "Calendar",
  "/today": "Today",
  "/accounts": "Accounts",
};

export function AppHeader() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Moniq";

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <PageContainer className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Foundational product surfaces with mock finance data.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search" className="pl-9" />
          </div>
          <Button>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </PageContainer>
    </header>
  );
}
