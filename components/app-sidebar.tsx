"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, ListChecks, Menu, Wallet } from "lucide-react";

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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden border-r bg-background lg:flex lg:flex-col">
        <div className="border-b px-6 py-5">
          <p className="font-heading text-xl font-semibold">Moniq</p>
          <p className="mt-1 text-sm text-muted-foreground">Personal finance foundation</p>
        </div>
        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="border-b bg-background lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-heading text-lg font-semibold">Moniq</p>
            <p className="text-xs text-muted-foreground">Personal finance foundation</p>
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
              <nav className="space-y-1 px-4 pb-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
