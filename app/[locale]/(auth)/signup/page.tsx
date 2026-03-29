import { getLocale } from "next-intl/server";

import { AuthForm } from "@/features/auth/components/auth-form";
import { signUp } from "@/features/auth/actions";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect({ href: "/dashboard", locale });
  }

  return <AuthForm mode="signup" action={signUp} />;
}
