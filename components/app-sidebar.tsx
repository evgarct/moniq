"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings2,
  Wallet,
} from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function AppSidebar({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const initial = user.email?.slice(0, 1).toUpperCase() ?? "M";

  return (
    <>
      <aside className="hidden h-full border-r border-black/5 bg-[#f5f2ef] px-3 py-4 lg:flex lg:flex-col lg:items-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="rounded-full outline-none ring-0 transition-transform hover:scale-[1.03]"
                aria-label="Open profile menu"
              />
            }
          >
            <Avatar size="default" className="size-10 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
              <AvatarFallback className="bg-white text-[12px] font-semibold text-slate-700">{initial}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-2xl bg-white p-2">
            <DropdownMenuLabel className="px-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-slate-900">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Signed in</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-xl px-2 py-2 text-[13px] text-slate-700">
              <Settings2 className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <div className="px-1 py-1">
              <LogoutButton
                action={onSignOut}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-xl text-slate-700 hover:bg-slate-100"
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="mt-8 flex flex-1 flex-col items-center gap-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "group relative flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors",
                  active
                    ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                    : "hover:bg-white/80 hover:text-slate-900",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="border-b border-black/5 bg-white/90 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="rounded-full outline-none ring-0"
                  aria-label="Open profile menu"
                />
              }
            >
              <Avatar size="default" className="size-9 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                <AvatarFallback className="bg-white text-[12px] font-semibold text-slate-700">{initial}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-2xl bg-white p-2">
              <DropdownMenuLabel className="px-2 py-2">
                <p className="truncate text-[12px] font-medium text-slate-900">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl px-2 py-2 text-[13px] text-slate-700">
                <Settings2 className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <div className="px-1 py-1">
                <LogoutButton action={onSignOut} variant="ghost" size="sm" className="w-full justify-start rounded-xl text-slate-700 hover:bg-slate-100" />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

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
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
