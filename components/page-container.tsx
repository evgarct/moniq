import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-full w-full overflow-y-auto overscroll-contain px-4 pt-5 pb-[calc(104px+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:pb-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
