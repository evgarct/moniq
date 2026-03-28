"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

import type { AuthActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: AuthActionState = {
  values: {
    email: "",
  },
};

type AuthFormProps = {
  mode: "login" | "signup";
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
};

function SubmitButton({ mode }: { mode: AuthFormProps["mode"] }) {
  const { pending } = useFormStatus();
  const labels = {
    login: {
      idle: "Log in",
      pending: "Signing in...",
    },
    signup: {
      idle: "Create account",
      pending: "Creating account...",
    },
  };

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {pending ? labels[mode].pending : labels[mode].idle}
    </Button>
  );
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(action, initialState);
  const next = searchParams.get("next") ?? "/dashboard";
  const message = searchParams.get("message");

  const title = mode === "login" ? "Welcome back" : "Create your Moniq account";
  const description =
    mode === "login"
      ? "Sign in with your email and password to continue."
      : "Create a secure account to start managing your money.";
  const alternateHref = mode === "login" ? "/signup" : "/login";
  const alternateLabel = mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in";

  return (
    <Card className="w-full max-w-md border-border shadow-none">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          {message ? (
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {message}
            </div>
          ) : null}

          {state.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={`${mode}-email`} className="text-sm font-medium">
              Email
            </label>
            <Input
              id={`${mode}-email`}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.values?.email ?? ""}
              placeholder="you@example.com"
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
            {state.fieldErrors?.email ? (
              <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor={`${mode}-password`} className="text-sm font-medium">
              Password
            </label>
            <Input
              id={`${mode}-password`}
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="At least 8 characters"
              aria-invalid={Boolean(state.fieldErrors?.password)}
              required
            />
            {state.fieldErrors?.password ? (
              <p className="text-sm text-destructive">{state.fieldErrors.password}</p>
            ) : null}
          </div>

          <SubmitButton mode={mode} />
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href={alternateHref} className="font-medium text-foreground hover:underline">
            {alternateLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
