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
    <div className="min-h-screen bg-[#203847]">
      <div className="grid min-h-screen lg:grid-cols-[76px_minmax(0,1fr)]">
        <AppSidebar user={user} onSignOut={signOut} />
        <div className="min-w-0 bg-[radial-gradient(circle_at_top,#315160_0%,#203847_55%,#152733_100%)]">
          <AppHeader user={user} onSignOut={signOut} />
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
