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
    <div className="h-screen w-screen overflow-hidden bg-[#ece8e4]">
      <div className="grid h-full w-full lg:grid-cols-[76px_minmax(0,1fr)]">
          <AppSidebar user={user} onSignOut={signOut} />
          <div className="min-w-0 overflow-hidden bg-[#fbf8f4]">
            <AppHeader user={user} onSignOut={signOut} />
            <main className="h-[calc(100vh-57px)] overflow-hidden">{children}</main>
          </div>
      </div>
    </div>
  );
}
