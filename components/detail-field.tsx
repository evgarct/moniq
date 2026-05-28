import { Field, FieldTitle } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type DetailFieldProps = {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DetailField({ label, children, className, contentClassName }: DetailFieldProps) {
  return (
    <Field className={cn("gap-1 rounded-control border border-border/70 bg-background px-3 py-2", className)}>
      <FieldTitle className="type-body-12 font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </FieldTitle>
      <div className={cn("type-body-14 min-w-0 text-foreground", contentClassName)}>{children}</div>
    </Field>
  );
}

export function DetailFieldGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>;
}
