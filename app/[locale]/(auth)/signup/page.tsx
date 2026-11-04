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
    return redirect({ href: "/today", locale });
  }

  return (
    <main className="h-full overflow-y-auto bg-muted/30">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <AuthForm mode="signup" action={signUp} />
      </section>
    </main>
  );
}
