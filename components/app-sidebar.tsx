"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings2,
  Wallet,
} from "lucide-react";

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
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/today", label: "Today", icon: ListChecks },
  { href: "/accounts", label: "Accounts", icon: Wallet },
];

const utilities = [
  { label: "Settings", icon: Settings2 },
  { label: "Analytics", icon: BarChart3 },
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
      <aside className="hidden w-[220px] border-r border-black/5 bg-[#f5f2ef] px-4 py-5 lg:flex lg:flex-col">
        <div className="mb-6">
          <p className="text-[13px] font-medium text-slate-900">Moniq Workspace</p>
          <p className="mt-1 text-[11px] text-slate-500">Accounts & allocations</p>
        </div>

        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-slate-600 transition-colors",
                  active
                    ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                    : "hover:bg-white/70 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-6 space-y-1">
          {utilities.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-slate-500"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
            );
          })}
        </div>

        <div className="mt-auto rounded-2xl border border-black/5 bg-white/80 p-3">
          <p className="truncate text-[12px] font-medium text-slate-900">{user.email}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Signed in</p>
          <LogoutButton
            action={onSignOut}
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          />
        </div>
      </aside>

      <div className="border-b border-black/5 bg-white/90 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-slate-900">Moniq</p>
            <p className="text-[11px] text-slate-500">{user.email}</p>
          </div>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon-sm" className="rounded-xl bg-white" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-[#f5f2ef]">
              <SheetHeader>
                <SheetTitle>Workspace</SheetTitle>
                <SheetDescription>Navigate Moniq product surfaces.</SheetDescription>
              </SheetHeader>
              <nav className="space-y-1 px-4 pb-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-slate-600 transition-colors",
                        active
                          ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                          : "hover:bg-white/70 hover:text-slate-900",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-black/5 px-4 py-4">
                <LogoutButton action={onSignOut} variant="outline" className="w-full justify-center rounded-xl bg-white" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
