import { cn } from "@/lib/utils";

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "base" | "raised" | "floating" | "canvas" | "panel";
  padding?: "none" | "sm" | "md" | "lg";
};

type WorkspaceSurfaceProps = {
  as?: "div" | "section";
  children: React.ReactNode;
  className?: string;
  elevation?: "base" | "raised";
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
  base: "surface-base",
  raised: "surface-raised",
  floating: "surface-floating",
  canvas: "surface-base",
  panel: "surface-raised",
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
  tone = "raised",
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

export function WorkspaceSurface({
  as: Component = "div",
  children,
  className,
  elevation = "base",
}: WorkspaceSurfaceProps) {
  return (
    <Component
      data-surface-elevation={elevation}
      className={cn(
        "min-h-0 min-w-0",
        elevation === "base" ? "surface-base" : "surface-raised",
        className,
      )}
    >
      {children}
    </Component>
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
