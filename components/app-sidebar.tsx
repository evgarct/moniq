"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  ListChecks,
  FileUp,
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
  { href: "/imports", labelKey: "imports", icon: FileUp },
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
          const label = navT(item.labelKey);

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

      <UserNavMenu user={user} onSignOut={onSignOut} mobile />
    </nav>
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
              className="flex w-16 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
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
            <UserRound className="h-[22px] w-[22px]" />
            <span>{navT("profile")}</span>
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
