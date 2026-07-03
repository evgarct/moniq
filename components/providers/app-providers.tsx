"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

import { makeQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/sonner";
import { LocalFirstProvider } from "@/features/sync/components/local-first-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <Theme theme={neutralTheme} mode="light">
      <QueryClientProvider client={queryClient}>
        <LocalFirstProvider>
          {children}
          <Toaster position="top-center" />
        </LocalFirstProvider>
      </QueryClientProvider>
    </Theme>
  );
}
