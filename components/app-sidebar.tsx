"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, ListChecks, Menu, Wallet } from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/today", label: "Today", icon: ListChecks },
  { href: "/accounts", label: "Accounts", icon: Wallet },
];

export function AppSidebar({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden border-r border-slate-700/70 bg-slate-800 text-slate-100 lg:flex lg:flex-col">
        <div className="border-b border-slate-700/70 px-4 py-4">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-50">Moniq</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Personal finance</p>
        </div>
        <nav className="space-y-0.5 p-2.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-[12px] transition-colors",
                  active
                    ? "border-cyan-400 bg-slate-700/60 text-slate-50"
                    : "text-slate-300 hover:bg-slate-700/35 hover:text-slate-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-slate-700/70 px-4 py-3">
          <div className="mb-2 min-w-0">
            <p className="truncate text-[12px] font-medium text-slate-100">{user.email}</p>
            <p className="text-[11px] text-slate-400">Signed in</p>
          </div>
          <LogoutButton action={onSignOut} variant="ghost" className="w-full justify-start px-2 text-slate-300 hover:bg-slate-700/35 hover:text-slate-50" />
        </div>
      </aside>

      <div className="border-b bg-background lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">Moniq</p>
            <p className="text-[11px] text-muted-foreground">Personal finance</p>
          </div>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon-sm" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Browse the first Moniq product surfaces.</SheetDescription>
              </SheetHeader>
              <nav className="space-y-0.5 px-4 pb-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] transition-colors",
                        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t px-4 py-4">
                <div className="mb-2 min-w-0">
                  <p className="truncate text-[12px] font-medium">{user.email}</p>
                  <p className="text-[11px] text-muted-foreground">Signed in</p>
                </div>
                <LogoutButton action={onSignOut} variant="ghost" className="w-full justify-start px-2 text-muted-foreground hover:text-foreground" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
