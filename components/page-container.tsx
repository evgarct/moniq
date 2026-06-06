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
        "mobile-nav-scroll-clearance h-full w-full overflow-y-auto overscroll-contain px-4 py-5 [scroll-padding-bottom:calc(76px+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:[scroll-padding-bottom:1rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}
