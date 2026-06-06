import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <PageContainer className="overflow-hidden px-0 py-0 sm:px-0 sm:py-0">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col bg-card px-4 py-5 sm:px-6 lg:px-7">
          <Skeleton className="h-8 w-44 rounded-[var(--radius-control)]" />
          <div className="mt-8 flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-[var(--radius-control)]" />
            <Skeleton className="h-16 w-full rounded-[var(--radius-control)]" />
            <Skeleton className="h-16 w-full rounded-[var(--radius-control)]" />
          </div>
        </section>
        <section className="hidden min-h-0 flex-col px-7 py-8 lg:flex">
          <Skeleton className="h-8 w-52 rounded-[var(--radius-control)]" />
          <div className="mt-8 flex flex-col gap-3">
            <Skeleton className="h-14 w-full rounded-[var(--radius-control)]" />
            <Skeleton className="h-14 w-full rounded-[var(--radius-control)]" />
            <Skeleton className="h-14 w-full rounded-[var(--radius-control)]" />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
