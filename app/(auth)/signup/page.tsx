import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth/components/auth-form";
import { signUp } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <AuthForm mode="signup" action={signUp} />;
}
