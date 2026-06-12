"use client";

import { cn } from "@/lib/utils";
import { WorkspaceSurface } from "@/components/surface";

export function FinanceBoardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <WorkspaceSurface
      as="section"
      elevation="base"
      className={cn("relative flex flex-col overflow-hidden", className)}
    >
      {children}
    </WorkspaceSurface>
  );
}

export function FinanceBoardHeader({
  title,
  actions,
  className,
}: {
  title: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 py-4", className)}>
      <h1 className="type-h4">{title}</h1>
      {actions}
    </div>
  );
}

export function FinanceBoardPanel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <WorkspaceSurface as="section" elevation="raised" className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <p className="type-body-12 font-semibold uppercase tracking-[0.18em]">{title}</p>
          {subtitle ? <p className="type-body-12 mt-1">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">{children}</div>
    </WorkspaceSurface>
  );
}
