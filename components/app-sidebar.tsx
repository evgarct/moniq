"use client";

import { useTranslations } from "next-intl";
import {
  ListChecks,
  Menu,
  Scale,
  Settings2,
  WalletCards,
} from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/today", labelKey: "today", icon: ListChecks },
  { href: "/accounts", labelKey: "balance", icon: Scale },
  { href: "/budget", labelKey: "budget", icon: WalletCards },
] as const;

export function AppSidebar({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  const t = useTranslations();
  const navT = useTranslations("navigation");
  const pathname = usePathname();
  const initial = user.email?.slice(0, 1).toUpperCase() ?? "M";

  return (
    <>
      <aside className="hidden h-full border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex lg:flex-col lg:items-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
                <button
                  type="button"
                  className="rounded-full outline-none ring-0 transition-transform hover:scale-[1.03]"
                  aria-label={t("navigation.openProfileMenu")}
                />
              }
            >
            <Avatar size="default" className="size-10 border border-sidebar-border bg-sidebar-accent">
              <AvatarFallback className="bg-sidebar-accent text-[12px] font-semibold text-sidebar-foreground">{initial}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-2xl p-2">
            <div className="px-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-foreground">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t("common.states.signedIn")}</p>
              </div>
            </div>
            <div className="px-2 py-2">
              <LocaleSwitcher />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-xl px-2 py-2 text-[13px]">
              <Settings2 />
              {t("common.actions.settings")}
            </DropdownMenuItem>
            <div className="px-1 py-1">
              <LogoutButton
                action={onSignOut}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-xl"
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="mt-8 flex flex-1 flex-col items-center gap-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const label = navT(item.labelKey);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={label}
                className={cn(
                  "group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sidebar-foreground/55 transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-lg bg-card px-2 py-1 text-[11px] text-card-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  {label}
                </span>
                <span className="sr-only">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="border-b border-border bg-background lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="rounded-full outline-none ring-0"
                  aria-label={t("navigation.openProfileMenu")}
                />
              }
            >
              <Avatar size="default" className="size-9 border border-border bg-card">
                <AvatarFallback className="bg-card text-[12px] font-semibold text-foreground">{initial}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-2xl p-2">
              <div className="px-2 py-2">
                <p className="truncate text-[12px] font-medium text-foreground">{user.email}</p>
              </div>
              <div className="px-2 py-2">
                <LocaleSwitcher />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl px-2 py-2 text-[13px]">
                <Settings2 />
                {t("common.actions.settings")}
              </DropdownMenuItem>
              <div className="px-1 py-1">
                <LogoutButton action={onSignOut} variant="ghost" size="sm" className="w-full justify-start rounded-xl" />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-xl"
                  aria-label={t("navigation.openNavigation")}
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-background">
              <SheetHeader>
                <SheetTitle>{t("navigation.workspace")}</SheetTitle>
                <SheetDescription>{t("navigation.workspaceDescription")}</SheetDescription>
              </SheetHeader>
              <nav className="space-y-1 px-4 pb-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  const label = navT(item.labelKey);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-muted-foreground transition-colors",
                        active
                          ? "bg-card text-foreground"
                          : "hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
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

export function MobileBottomNav() {
  const navT = useTranslations("navigation");
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[64px] items-center justify-around border-t border-border bg-card px-2 lg:hidden text-[11px]">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        const label = navT(item.labelKey);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex w-16 flex-col items-center justify-center gap-1",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-[22px] w-[22px]" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
