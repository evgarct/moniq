"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { makeQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/sonner";
import { LocalFirstProvider } from "@/features/sync/components/local-first-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <LocalFirstProvider>
        {children}
        <Toaster position="top-center" />
      </LocalFirstProvider>
    </QueryClientProvider>
  );
}
