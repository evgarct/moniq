import { getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { LandingView } from "@/features/landing/components/landing-view";
import type { AppLocale } from "@/i18n/routing";

export default async function LocalizedHomePage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect({ href: "/today", locale: locale as AppLocale });
  }

  return <LandingView />;
}
