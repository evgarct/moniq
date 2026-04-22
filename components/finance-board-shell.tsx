"use client";

import { cn } from "@/lib/utils";

export function FinanceBoardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-[#78979a]/28 bg-[radial-gradient(circle_at_top,_rgba(94,145,147,0.22),_transparent_28%),linear-gradient(180deg,_#284b55_0%,_#173540_48%,_#112a34_100%)] text-[#f4f8f7] shadow-[0_24px_72px_rgba(8,20,24,0.28)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_18%,transparent_82%,rgba(0,0,0,0.14))]" />
      <div className="relative h-full">{children}</div>
    </section>
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
    <div className={cn("flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4", className)}>
      <h1 className="text-[20px] font-medium tracking-[-0.03em] text-[#f4f8f7]">{title}</h1>
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
    <section className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8fb0b1]">{title}</p>
          {subtitle ? <p className="mt-1 text-[12px] leading-5 text-[#729497]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">{children}</div>
    </section>
  );
}
