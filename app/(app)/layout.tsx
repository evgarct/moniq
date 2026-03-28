import { redirect } from "next/navigation";

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
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <AppSidebar user={user} onSignOut={signOut} />
        <div className="min-w-0 border-l border-border/60">
          <AppHeader user={user} onSignOut={signOut} />
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
