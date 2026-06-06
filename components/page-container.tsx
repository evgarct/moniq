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
        "h-full w-full overflow-y-auto overscroll-contain px-4 py-5 [scroll-padding-bottom:1rem] sm:px-6 sm:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
