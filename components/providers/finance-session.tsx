"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

import { resetFinanceSnapshotRequests } from "@/features/finance/lib/finance-api";
import { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";
import { createScheduleReconciliationRetry } from "@/lib/schedule-reconciliation-retry";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the online finance snapshot honest for the signed-in user: drops shared in-flight
 * reads when the account changes and extends recurring schedules at login, reconnect and month change.
 */
export function FinanceSession({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const t = useTranslations("mcp.errors");
  // Keep the translator out of effect dependencies: a changed identity would restart the reconciliation loop.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUserId(session?.user.id ?? null);
    });

    let lastUserId: string | null | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      // A shared in-flight snapshot read belongs to the previous account; never hand it to the next one.
      if (lastUserId !== undefined && lastUserId !== nextUserId) {
        resetFinanceSnapshotRequests();
        queryClient.removeQueries({ queryKey: financeSnapshotQueryKey });
      }
      lastUserId = nextUserId;
      setAuthUserId(nextUserId);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    let reconciling = false;
    const retry = createScheduleReconciliationRetry();
    const month = () => `${new Date().getFullYear()}-${new Date().getMonth()}`;
    const reconcile = async (reconnect = false) => {
      if (cancelled || reconciling || !navigator.onLine || !retry.shouldAttempt(month(), Date.now(), reconnect)) return;
      reconciling = true;
      try {
        const response = await fetch("/api/finance/schedules/reconcile", { method: "POST", credentials: "include" });
        if (!response.ok) throw new Error("schedule_reconciliation_failed");
        retry.succeeded(month());
        await queryClient.invalidateQueries({ queryKey: financeSnapshotQueryKey });
      } catch {
        if (retry.failed(Date.now()) && !cancelled) toast.error(tRef.current("scheduleReconcileFailed"));
      } finally {
        reconciling = false;
      }
    };
    const onOnline = () => {
      void reconcile(true);
    };
    const checkMonth = () => {
      if (document.visibilityState === "visible") void reconcile();
    };
    const timer = window.setInterval(checkMonth, 60_000);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", checkMonth);
    void reconcile();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", checkMonth);
    };
  }, [authUserId, queryClient]);

  return <>{children}</>;
}
