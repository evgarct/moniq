import { getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";

export default async function LocalizedHomePage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return redirect({ href: user ? "/today" : "/login", locale });
}
