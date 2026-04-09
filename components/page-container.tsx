import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("h-full w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-6", className)}>{children}</div>;
}
