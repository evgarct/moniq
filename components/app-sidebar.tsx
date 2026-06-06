"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Settings2,
  UserRound,
} from "lucide-react";
import {
  IconCalendar,
  IconCalendarFilled,
  IconMail,
  IconMailFilled,
  IconScale,
  IconScaleFilled,
  IconCreditCard,
  IconCreditCardFilled,
} from "@tabler/icons-react";
import { motion } from "framer-motion";

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
  { href: "/today",    labelKey: "today",    icon: IconCalendar,   iconFilled: IconCalendarFilled },
  { href: "/inbox",    labelKey: "inboxPage", icon: IconMail,        iconFilled: IconMailFilled },
  { href: "/accounts", labelKey: "balance",   icon: IconScale,       iconFilled: IconScaleFilled },
  { href: "/budget",   labelKey: "budget",    icon: IconCreditCard,  iconFilled: IconCreditCardFilled },
] as const;

type ShellUser = {
  email?: string | null;
};

export function AppSidebar({
  user,
  onSignOut,
}: {
  user: ShellUser;
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
  user: ShellUser;
  onSignOut: () => Promise<void>;
}) {
  const navT = useTranslations("navigation");
  const pathname = usePathname();

  return (
    <div
      data-mobile-nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pt-1 lg:hidden"
      style={{
        paddingBottom: "max(4px, env(safe-area-inset-bottom))",
        paddingLeft: "max(10px, env(safe-area-inset-left))",
        paddingRight: "max(10px, env(safe-area-inset-right))",
      }}
    >
      <nav
        className="pointer-events-auto grid h-[60px] w-full max-w-[460px] grid-cols-5 items-center rounded-[calc(var(--radius-floating)+8px)] px-1.5 text-[9px] text-muted-foreground shadow-[0_8px_24px_rgba(28,22,17,0.14)]"
        style={{
          background: "color-mix(in oklab, var(--popover) 1%, transparent)",
          backdropFilter: "saturate(100%) blur(4px)",
          WebkitBackdropFilter: "saturate(100%) blur(4px)",
        }}
      >
        {navigation.map((item) => {
          const active = pathname === item.href;
          const Icon = active ? item.iconFilled : item.icon;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const label = navT(item.labelKey as any);

          return (
            <Link
              key={item.href}
              href={item.href}
              draggable={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-full min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-[calc(var(--radius-control)+4px)] px-0.5 pt-0.5 [-webkit-tap-highlight-color:transparent] transition-[color,transform] duration-150 active:scale-[0.96]",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.div
                  layoutId="tab-active-bg"
                  className="absolute inset-x-0.5 top-1.5 bottom-1.5 rounded-[calc(var(--radius-control)+4px)] bg-secondary/70"
                  transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
                />
              )}
              <Icon size={22} className="relative shrink-0" />
              <span className={cn("relative max-w-full whitespace-nowrap leading-[11px] tracking-normal", active && "font-semibold")}>{label}</span>
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
  user: ShellUser;
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
              className="flex h-full min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-[calc(var(--radius-control)+4px)] px-0.5 pt-0.5 text-[9px] text-muted-foreground [-webkit-tap-highlight-color:transparent] transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.96]"
              aria-label={t("navigation.openProfileMenu")}
            />
          ) : (
            <button
              type="button"
              className="group relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-floating)] text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={t("navigation.openProfileMenu")}
            />
          )
        }
      >
        {mobile ? (
          <>
            <UserRound className="h-[22px] w-[22px] shrink-0" />
            <span className="max-w-full whitespace-nowrap leading-[11px] tracking-normal">{navT("profile")}</span>
          </>
        ) : (
          <>
            <UserRound className="h-5 w-5" />
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-[var(--radius-floating)] border border-border/70 bg-[#ece8e1] px-4 py-2 text-[13px] font-medium text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {navT("profile")}
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-[var(--radius-floating)] p-2"
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
        "group relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-floating)] text-sidebar-foreground/55 transition-colors",
        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-[var(--radius-floating)] border border-border/70 bg-[#ece8e1] px-4 py-2 text-[13px] font-medium text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
