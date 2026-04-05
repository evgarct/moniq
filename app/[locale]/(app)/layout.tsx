import { signOut } from "@/features/auth/actions";
import { GlobalTransactionFab } from "@/features/transactions/components/global-transaction-fab";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar, MobileBottomNav } from "@/components/app-sidebar";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <div className="grid h-full w-full lg:grid-cols-[76px_minmax(0,1fr)] pb-[64px] lg:pb-0">
        <AppSidebar user={user} onSignOut={signOut} />
        <div className="min-w-0 overflow-hidden bg-background">
          <main className="h-[calc(100vh-64px)] lg:h-screen overflow-hidden">
            {children}
          </main>
        </div>
      </div>

      <GlobalTransactionFab />
      <MobileBottomNav user={user} onSignOut={signOut} />
    </div>
  );
}
