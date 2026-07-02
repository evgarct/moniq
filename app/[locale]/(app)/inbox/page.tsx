import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { InboxView } from "@/features/inbox/components/inbox-view";
import type { AppLocale } from "@/i18n/routing";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect({ href: "/login", locale: locale as AppLocale });
  }

  return <InboxView />;
}
