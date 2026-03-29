"use server";

import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPathname, redirect } from "@/i18n/navigation";

export type AuthActionState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
  values?: {
    email: string;
  };
};

function normalizeCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  return { email, password };
}

function validateCredentials(
  email: string,
  password: string,
  mode: "login" | "signup",
  t: (
    key:
      | "errors.emailRequired"
      | "errors.emailInvalid"
      | "errors.passwordRequired"
      | "errors.passwordMin",
  ) => string,
) {
  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!email) {
    fieldErrors.email = t("errors.emailRequired");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = t("errors.emailInvalid");
  }

  if (!password) {
    fieldErrors.password = t("errors.passwordRequired");
  } else if (mode === "signup" && password.length < 8) {
    fieldErrors.password = t("errors.passwordMin");
  }

  return fieldErrors;
}

async function getOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function getRedirectPath(formData: FormData) {
  const next = String(formData.get("next") ?? "").trim();

  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/dashboard";
}

export async function signInWithPassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });
  const { email, password } = normalizeCredentials(formData);
  const fieldErrors = validateCredentials(email, password, "login", t);

  if (fieldErrors.email || fieldErrors.password) {
    return {
      fieldErrors,
      values: { email },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: error.message,
      values: { email },
    };
  }

  return redirect({ href: getRedirectPath(formData), locale });
}

export async function signUp(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });
  const { email, password } = normalizeCredentials(formData);
  const fieldErrors = validateCredentials(email, password, "signup", t);

  if (fieldErrors.email || fieldErrors.password) {
    return {
      fieldErrors,
      values: { email },
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}${getPathname({ locale, href: "/login" })}`,
    },
  });

  if (error) {
    return {
      error: error.message,
      values: { email },
    };
  }

  if (data.session) {
    return redirect({ href: getRedirectPath(formData), locale });
  }

  return redirect({
    href: {
      pathname: "/login",
      query: {
        message: t("messages.confirmEmail"),
      },
    },
    locale,
  });
}

export async function signOut() {
  const locale = await getLocale();
  const supabase = await createClient();

  await supabase.auth.signOut();
  return redirect({ href: "/login", locale });
}
