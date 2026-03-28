import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth/components/auth-form";
import { signInWithPassword } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <AuthForm mode="login" action={signInWithPassword} />;
}
