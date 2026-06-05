"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";

import { Surface, SurfaceDescription, SurfaceEyebrow, SurfaceHeader } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { getBillingAccessState, type BillingEntitlement } from "@/lib/billing/access";

type BillingSettingsProps = {
  entitlement: BillingEntitlement | null;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

async function redirectToBillingRoute(route: "/api/billing/checkout" | "/api/billing/portal", locale: string) {
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });

  const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !payload?.url) {
    throw new Error("billing_request_failed");
  }

  window.location.href = payload.url;
}

export function BillingSettings({ entitlement }: BillingSettingsProps) {
  const t = useTranslations("settings.billing");
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "checkout" | "portal" | "error">("idle");
  const state = getBillingAccessState(entitlement);
  const periodEnd = formatDate(entitlement?.current_period_end ?? null, locale);
  const trialEnd = formatDate(entitlement?.trial_end ?? null, locale);
  const isBlocked = state === "blocked";
  const canManage = Boolean(entitlement?.stripe_customer_id);
  const hasUsedTrial = Boolean(entitlement?.stripe_subscription_id || entitlement?.trial_end);

  const description = useMemo(() => {
    if (state === "always_paid") return t("state.alwaysPaid");
    if (state === "trialing") return trialEnd ? t("state.trialingUntil", { date: trialEnd }) : t("state.trialing");
    if (state === "active") return periodEnd ? t("state.activeUntil", { date: periodEnd }) : t("state.active");
    if (state === "canceling") return periodEnd ? t("state.cancelingUntil", { date: periodEnd }) : t("state.canceling");
    return t("state.blocked");
  }, [periodEnd, state, t, trialEnd]);

  async function startCheckout() {
    setStatus("checkout");
    try {
      await redirectToBillingRoute("/api/billing/checkout", locale);
    } catch {
      setStatus("error");
    }
  }

  async function openPortal() {
    setStatus("portal");
    try {
      await redirectToBillingRoute("/api/billing/portal", locale);
    } catch {
      setStatus("error");
    }
  }

  return (
    <Surface tone="panel" padding="lg">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <SurfaceHeader className="mb-5 px-0">
            <div className="flex flex-col gap-1">
              <SurfaceEyebrow>{t("eyebrow")}</SurfaceEyebrow>
              <h2 className="type-h5 text-foreground">{t("title")}</h2>
              <SurfaceDescription>{t("description")}</SurfaceDescription>
            </div>
          </SurfaceHeader>

          <div className="flex flex-col gap-4">
            <div>
              <p className="type-body-12 font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t(`labels.${state}`)}
              </p>
              <p className="type-body-14 mt-1 text-foreground">{description}</p>
              {status === "error" ? (
                <p className="type-body-12 mt-2 text-destructive">{t("requestError")}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {isBlocked ? (
                <Button type="button" onClick={startCheckout} disabled={status === "checkout"}>
                  {status === "checkout"
                    ? t(hasUsedTrial ? "actions.subscribing" : "actions.starting")
                    : t(hasUsedTrial ? "actions.subscribe" : "actions.start")}
                </Button>
              ) : null}
              {canManage && state !== "always_paid" ? (
                <Button type="button" variant="outline" onClick={openPortal} disabled={status === "portal"}>
                  {status === "portal" ? t("actions.openingPortal") : t("actions.manage")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}
