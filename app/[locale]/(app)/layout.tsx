import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { signOut } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar, MobileBottomNav } from "@/components/app-sidebar";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getFinanceSnapshot } from "@/features/finance/server/repository";
import { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";

export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale = locale as AppLocale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect({ href: "/login", locale: validLocale });
  }

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: financeSnapshotQueryKey,
      queryFn: getFinanceSnapshot,
    });
  } catch {
    // prefetch failed — client will fetch on demand
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <div className="grid h-full w-full lg:grid-cols-[76px_minmax(0,1fr)] pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0">
        <AppSidebar user={user} onSignOut={signOut} />
        <div className="min-w-0 overflow-hidden bg-background">
          <main className="h-[calc(100vh-56px-env(safe-area-inset-bottom))] lg:h-screen overflow-hidden">
            <HydrationBoundary state={dehydrate(queryClient)}>
              {children}
            </HydrationBoundary>
          </main>
        </div>
      </div>

      <MobileBottomNav user={user} onSignOut={signOut} />
    </div>
  );
}
