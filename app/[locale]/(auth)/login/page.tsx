import { getLocale } from "next-intl/server";

import { AuthForm } from "@/features/auth/components/auth-form";
import { BrandLogin } from "@/features/auth/components/brand-login";
import { signInWithPassword } from "@/features/auth/actions";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect({ href: "/today", locale });
  }

  return (
    <BrandLogin>
      <AuthForm mode="login" action={signInWithPassword} />
    </BrandLogin>
  );
}
