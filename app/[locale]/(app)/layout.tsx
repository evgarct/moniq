import { signOut } from "@/features/auth/actions";
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
  const { data: claimData } = await supabase.auth.getClaims();
  const claims = claimData?.claims;

  if (!claims?.sub) {
    return redirect({ href: "/login", locale: validLocale });
  }

  const shellUser = {
    email: typeof claims.email === "string" ? claims.email : null,
  };

  return (
    <div className="mobile-shell h-dvh w-screen overflow-hidden bg-card">
      <div className="grid h-full min-h-0 w-full lg:grid-cols-[76px_minmax(0,1fr)]">
        <AppSidebar user={shellUser} onSignOut={signOut} />
        <div className="min-h-0 min-w-0 overflow-hidden bg-background">
          <main className="h-full min-h-0 overflow-hidden lg:h-screen">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav user={shellUser} onSignOut={signOut} />
    </div>
  );
}
