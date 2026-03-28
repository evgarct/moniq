import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section className={cn("border-b border-border/70", className)}>
      <div className="flex items-start justify-between gap-4 py-3">
        <div className="space-y-0.5">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {description ? <p className="text-[12px] text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("pb-3", contentClassName)}>{children}</div>
    </section>
  );
}
