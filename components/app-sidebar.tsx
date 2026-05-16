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
  { href: "/today",    labelKey: "today",    icon: IconCalendar,   iconFilled: IconCalendarFilled },
  { href: "/inbox",    labelKey: "inboxPage", icon: IconMail,        iconFilled: IconMailFilled },
  { href: "/accounts", labelKey: "balance",   icon: IconScale,       iconFilled: IconScaleFilled },
  { href: "/budget",   labelKey: "budget",    icon: IconCreditCard,  iconFilled: IconCreditCardFilled },
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
      {/* Ein UI–style animated glow */}
      <motion.div
        className="absolute -inset-x-4 -top-3 h-16 rounded-t-3xl"
        style={{
          background: "linear-gradient(to right, rgba(99,179,237,0.15), rgba(99,102,241,0.15), rgba(167,139,250,0.15))",
          filter: "blur(16px)",
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />

      <nav
        className="relative flex items-start justify-around px-1 pt-2 text-[10px]"
        style={{
          paddingBottom: "6px",
          background: "rgba(255, 255, 255, 0.25)",
          backdropFilter: "saturate(200%) blur(28px)",
          WebkitBackdropFilter: "saturate(200%) blur(28px)",
          borderTop: "0.5px solid rgba(255, 255, 255, 0.6)",
          boxShadow: "0 -1px 0 0 rgba(255,255,255,0.4) inset",
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
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-0.5 transition-colors duration-200",
                active ? "text-[#4f8ef7]" : "text-foreground/35",
              )}
            >
              {active && (
                <motion.div
                  layoutId="tab-active-bg"
                  className="absolute -inset-x-2 -inset-y-0.5 rounded-xl bg-[#4f8ef7]/10"
                  transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
                />
              )}
              <Icon size={24} className="relative" />
              <span className={cn("relative leading-none tracking-tight", active && "font-semibold")}>{label}</span>
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
              className="flex flex-col items-center gap-1 px-4 py-0.5 text-[10px] text-foreground/35 transition-colors hover:text-foreground/60"
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
            <UserRound className="h-[24px] w-[24px]" />
            <span className="leading-none tracking-tight">{navT("profile")}</span>
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
