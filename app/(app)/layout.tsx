import { redirect } from "next/navigation";
import { Calendar, Home, PiggyBank, ReceiptText, Wallet } from "lucide-react";

import { signOut } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <div className="grid h-full w-full lg:grid-cols-[76px_minmax(0,1fr)] pb-[64px] lg:pb-0">
        <AppSidebar user={user} onSignOut={signOut} />
        <div className="min-w-0 overflow-hidden bg-background">
          <AppHeader user={user} onSignOut={signOut} />
          <main className="h-[calc(100vh-57px-64px)] lg:h-[calc(100vh-57px)] overflow-hidden">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[64px] items-center justify-around border-t border-border bg-card px-2 lg:hidden text-[11px]">
        <div className="flex w-16 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
          <Home className="h-[22px] w-[22px]" />
          <span>Dashboard</span>
        </div>
        <div className="flex w-16 flex-col items-center justify-center gap-1 text-foreground">
          <Wallet className="h-[22px] w-[22px]" />
          <span>Accounts</span>
        </div>
        <div className="flex w-16 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
          <Calendar className="h-[22px] w-[22px]" />
          <span>Calendar</span>
        </div>
        <div className="flex w-16 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
          <ReceiptText className="h-[22px] w-[22px]" />
          <span>Transactions</span>
        </div>
        <div className="flex w-16 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
          <PiggyBank className="h-[22px] w-[22px]" />
          <span>Savings</span>
        </div>
      </nav>
    </div>
  );
}
