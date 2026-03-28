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
    <div className="min-h-screen bg-[#cfcfd1] px-4 py-6 sm:px-6">
      <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-[1180px] overflow-hidden rounded-[28px] border border-white/75 bg-[#fbf8f4] shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
        <div className="grid min-h-[calc(100vh-3rem)] lg:grid-cols-[220px_minmax(0,1fr)]">
          <AppSidebar user={user} onSignOut={signOut} />
          <div className="min-w-0">
            <AppHeader user={user} onSignOut={signOut} />
            <main>{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
