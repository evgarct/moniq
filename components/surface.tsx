import { cn } from "@/lib/utils";

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "canvas" | "panel" | "floating";
  padding?: "none" | "sm" | "md" | "lg";
};

type SurfaceHeaderProps = {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

type SurfaceTextProps = {
  children: React.ReactNode;
  className?: string;
};

const toneClasses: Record<NonNullable<SurfaceProps["tone"]>, string> = {
  canvas: "bg-background",
  panel: "bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
  floating: "border border-border/70 bg-popover shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
};

const paddingClasses: Record<NonNullable<SurfaceProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Surface({
  children,
  className,
  tone = "panel",
  padding = "md",
}: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-[24px]",
        toneClasses[tone],
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SurfaceHeader({ children, action, className }: SurfaceHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-1", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SurfaceEyebrow({ children, className }: SurfaceTextProps) {
  return (
    <p className={cn("type-body-12 font-semibold uppercase tracking-[0.18em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function SurfaceTitle({ children, className }: SurfaceTextProps) {
  return <h2 className={cn("type-h3", className)}>{children}</h2>;
}

export function SurfaceDescription({ children, className }: SurfaceTextProps) {
  return <p className={cn("type-body-14 max-w-2xl text-muted-foreground", className)}>{children}</p>;
}
