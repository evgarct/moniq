import { cn } from "@/lib/utils";

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "canvas" | "panel" | "floating";
  padding?: "none" | "sm" | "md" | "lg";
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
