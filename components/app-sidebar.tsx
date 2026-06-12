"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Settings2,
  UserRound,
} from "lucide-react";
import {
  IconCalendar,
  IconCreditCard,
  IconMail,
  IconScale,
  IconUser,
} from "@tabler/icons-react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/features/auth/components/logout-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/today",    labelKey: "today",     icon: IconCalendar },
  { href: "/inbox",    labelKey: "inboxPage", icon: IconMail },
  { href: "/accounts", labelKey: "balance",   icon: IconScale },
  { href: "/budget",   labelKey: "budget",    icon: IconCreditCard },
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
    <aside className="hidden h-full bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex lg:flex-col lg:items-center">
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
        className="pointer-events-auto grid h-[60px] w-full max-w-[460px] grid-cols-5 items-center rounded-[var(--radius-floating)] border border-border/70 bg-popover px-1.5 py-1.5 text-xs text-muted-foreground"
      >
        {navigation.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const label = navT(item.labelKey as any);

          return (
            <Link
              key={item.href}
              href={item.href}
              draggable={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-full min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-0.5 [-webkit-tap-highlight-color:transparent] transition-[color,background-color,transform] duration-150 active:scale-[0.96]",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <Icon size={22} className="shrink-0" />
              <span className={cn("max-w-full truncate leading-none", active && "font-semibold")}>{label}</span>
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

  const trigger = (
    <button
      type="button"
      className={cn(
        mobile
          ? "flex h-full min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-0.5 text-xs text-muted-foreground [-webkit-tap-highlight-color:transparent] transition-[color,background-color,transform] duration-150 hover:bg-secondary/50 hover:text-foreground active:scale-[0.96]"
          : "flex size-11 items-center justify-center rounded-[var(--radius-floating)] text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
      aria-label={t("navigation.openProfileMenu")}
    />
  );

  return (
    <Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={mobile ? trigger : <TooltipTrigger render={trigger} />}
        >
          {mobile ? (
            <IconUser className="size-[22px] shrink-0" />
          ) : (
            <UserRound className="size-5" />
          )}
          {mobile ? (
            <span className="max-w-full truncate leading-none">{navT("profile")}</span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 rounded-[var(--radius-floating)] p-2"
          side={mobile ? "top" : "right"}
          align={mobile ? "end" : "start"}
          sideOffset={mobile ? 10 : 12}
        >
          <div className="px-2 py-2">
            <div className="min-w-0">
              <p className="type-body-12 truncate font-medium text-foreground">{user.email}</p>
              <p className="type-body-12 mt-0.5">{t("common.states.signedIn")}</p>
            </div>
          </div>
          <div className="px-2 py-2">
            <LocaleSwitcher />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="rounded-[var(--radius-control)] px-2 py-2"
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
              className="w-full justify-start"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {!mobile ? <TooltipContent side="right">{navT("profile")}</TooltipContent> : null}
    </Tooltip>
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
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={label}
            className={cn(
              "flex size-11 items-center justify-center rounded-[var(--radius-floating)] text-sidebar-foreground/55 transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          />
        }
      >
        <Icon className="size-5" />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
