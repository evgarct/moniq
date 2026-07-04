"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import type { AuthActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceHeader, SurfaceTitle, SurfaceDescription } from "@/components/surface";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

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
  const t = useTranslations(`auth.${mode}`);
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {pending ? t("submitPending") : t("submitIdle")}
    </Button>
  );
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(action, initialState);
  const next = searchParams.get("next") ?? "/today";
  const message = searchParams.get("message");

  const alternateHref = mode === "login" ? "/signup" : "/login";

  return (
    <Surface tone="panel" padding="lg" className="w-full max-w-md border border-border">
      <SurfaceHeader className="flex flex-col gap-1 mb-5 px-0">
        <SurfaceTitle className="text-2xl">{t(`auth.${mode}.title`)}</SurfaceTitle>
        <SurfaceDescription>{t(`auth.${mode}.description`)}</SurfaceDescription>
      </SurfaceHeader>
      <div className="px-0">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          {message ? (
            <div className="rounded-[var(--radius-control)] border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {message}
            </div>
          ) : null}

          {state.error ? (
            <div className="rounded-[var(--radius-control)] border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={`${mode}-email`} className="text-sm font-medium">
              {t("auth.fields.email")}
            </label>
            <Input
              id={`${mode}-email`}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.values?.email ?? ""}
              placeholder={t("auth.fields.emailPlaceholder")}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
            {state.fieldErrors?.email ? (
              <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor={`${mode}-password`} className="text-sm font-medium">
              {t("auth.fields.password")}
            </label>
            <Input
              id={`${mode}-password`}
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={t("auth.fields.passwordPlaceholder")}
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
            {t(`auth.${mode}.alternate`)}
          </Link>
        </p>
      </div>
    </Surface>
  );
}
