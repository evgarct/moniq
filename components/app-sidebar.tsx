"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  ListChecks,
  Inbox,
  Scale,
  Settings2,
  UserRound,
  WalletCards,
} from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/features/auth/components/logout-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/today", labelKey: "today", icon: ListChecks },
  { href: "/inbox", labelKey: "inboxPage", icon: Inbox },
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
  const navT = useTranslations("navigation");
  const pathname = usePathname();

  return (
    <aside className="hidden h-full border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex lg:flex-col lg:items-center">
      <nav className="mt-2 flex flex-1 flex-col items-center gap-3">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const label = navT(item.labelKey as any);

          return (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              label={label}
              icon={Icon}
              active={active}
            />
          );
        })}
      </nav>
      <div className="mb-2">
        <UserNavMenu user={user} onSignOut={onSignOut} mobile={false} />
      </div>
    </aside>
  );
}

export function MobileBottomNav({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  const navT = useTranslations("navigation");
  const pathname = usePathname();

  return (
    <div
      data-mobile-nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <nav
        className="mx-3 mb-2 flex items-center justify-around rounded-[26px] px-1 py-1.5"
        style={{
          background: "rgba(255,255,255,0.45)",
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)",
        }}
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const label = navT(item.labelKey as any);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[10px] transition-colors",
                active ? "text-foreground" : "text-foreground/45",
              )}
            >
              <span
                className="flex items-center justify-center rounded-2xl transition-all"
                style={
                  active
                    ? {
                        padding: "6px 16px",
                        background: "rgba(255,255,255,0.75)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.90)",
                        border: "1px solid rgba(255,255,255,0.60)",
                      }
                    : { padding: "6px 10px" }
                }
              >
                <Icon className="h-[20px] w-[20px]" />
              </span>
              <span className={cn("leading-none tracking-tight", active && "font-medium")}>{label}</span>
            </Link>
          );
        })}

        <UserNavMenu user={user} onSignOut={onSignOut} mobile />
      </nav>
    </div>
  );
}

function UserNavMenu({
  user,
  onSignOut,
  mobile,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
  mobile: boolean;
}) {
  const t = useTranslations();
  const navT = useTranslations("navigation");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          mobile ? (
            <button
              type="button"
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] text-foreground/40 transition-colors hover:text-foreground/70"
              aria-label={t("navigation.openProfileMenu")}
            />
          ) : (
            <button
              type="button"
              className="group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={t("navigation.openProfileMenu")}
            />
          )
        }
      >
        {mobile ? (
          <>
            <span className="flex items-center justify-center px-2 py-1.5">
              <UserRound className="h-[20px] w-[20px]" />
            </span>
            <span className="leading-none tracking-tight">{navT("profile")}</span>
          </>
        ) : (
          <>
            <UserRound className="h-5 w-5" />
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-2xl border border-border/70 bg-[#ece8e1] px-4 py-2 text-[13px] font-medium text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {navT("profile")}
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-2xl p-2"
        side={mobile ? "top" : "right"}
        align={mobile ? "end" : "start"}
        sideOffset={mobile ? 10 : 12}
      >
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
        <DropdownMenuItem
          className="rounded-xl px-2 py-2 text-[13px]"
          render={<Link href="/settings" />}
        >
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
  );
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sidebar-foreground/55 transition-colors",
        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-2xl border border-border/70 bg-[#ece8e1] px-4 py-2 text-[13px] font-medium text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
