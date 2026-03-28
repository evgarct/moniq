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
  { href: "/accounts", label: "Balance", icon: Wallet },
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
      <aside className="hidden bg-[#334551] text-slate-100 lg:flex lg:flex-col">
        <div className="flex h-[52px] items-center justify-center border-b border-white/12">
          <div className="size-2 rounded-full bg-cyan-300" />
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1.5 px-2 py-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-full flex-col items-center gap-1 border-l-2 border-l-transparent px-1 py-2.5 text-center text-[11px] leading-4 transition-colors",
                  active
                    ? "border-l-cyan-400 bg-white/8 text-slate-50"
                    : "text-slate-300 hover:bg-white/5 hover:text-slate-50",
                )}
              >
                <Icon className="h-[22px] w-[22px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/12 px-1.5 py-2.5">
          <LogoutButton
            action={onSignOut}
            variant="ghost"
            className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[11px] text-slate-300 hover:bg-white/5 hover:text-slate-50"
            label="Logout"
          />
        </div>
      </aside>

      <div className="border-b bg-background lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">Moniq</p>
            <p className="text-[11px] text-muted-foreground">{user.email}</p>
          </div>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon-sm" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Browse the finance workspace.</SheetDescription>
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
                <LogoutButton action={onSignOut} variant="ghost" className="w-full justify-start px-2 text-muted-foreground hover:text-foreground" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
