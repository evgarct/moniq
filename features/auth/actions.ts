"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
) {
  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  } else if (mode === "signup" && password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
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
  const { email, password } = normalizeCredentials(formData);
  const fieldErrors = validateCredentials(email, password, "login");

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

  redirect(getRedirectPath(formData));
}

export async function signUp(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { email, password } = normalizeCredentials(formData);
  const fieldErrors = validateCredentials(email, password, "signup");

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
      emailRedirectTo: `${origin}/login`,
    },
  });

  if (error) {
    return {
      error: error.message,
      values: { email },
    };
  }

  if (data.session) {
    redirect(getRedirectPath(formData));
  }

  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account.");
}

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect("/login");
}
