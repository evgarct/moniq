"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

import { makeQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/sonner";
import { LocalFirstProvider } from "@/features/sync/components/local-first-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isStorybook = typeof window !== "undefined" && window.location.href.includes("iframe.html");

    if (isStorybook) {
      const observer = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains("dark");
        setMode(isDark ? "dark" : "light");
        document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
      });

      const isDark = document.documentElement.classList.contains("dark");
      setMode(isDark ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    } else {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const syncTheme = (e: MediaQueryListEvent | MediaQueryList) => {
        const isDark = e.matches;
        setMode(isDark ? "dark" : "light");
        if (isDark) {
          document.documentElement.setAttribute("data-theme", "dark");
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.setAttribute("data-theme", "light");
          document.documentElement.classList.remove("dark");
        }
      };

      syncTheme(mediaQuery);
      mediaQuery.addEventListener("change", syncTheme);
      return () => mediaQuery.removeEventListener("change", syncTheme);
    }
  }, []);

  return (
    <Theme theme={neutralTheme} mode={mode}>
      <QueryClientProvider client={queryClient}>
        <LocalFirstProvider>
          {children}
          <Toaster position="top-center" />
        </LocalFirstProvider>
      </QueryClientProvider>
    </Theme>
  );
}
