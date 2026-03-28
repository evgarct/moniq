import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-5 lg:px-6", className)}>{children}</div>;
}
