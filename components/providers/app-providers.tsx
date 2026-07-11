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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(isDark ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    } else {
      type ThemeValue = "light" | "dark" | "system";

      const getStoredTheme = (): ThemeValue => {
        try {
          const stored = localStorage.getItem("theme");
          if (stored === "light" || stored === "dark" || stored === "system") {
            return stored;
          }
        } catch {}
        return "system";
      };

      const applyTheme = (themeValue: ThemeValue) => {
        let activeTheme: "light" | "dark" = "light";
        if (themeValue === "dark") {
          activeTheme = "dark";
        } else if (themeValue === "light") {
          activeTheme = "light";
        } else {
          const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          activeTheme = isDark ? "dark" : "light";
        }

        if (activeTheme === "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.setAttribute("data-theme", "light");
          document.documentElement.classList.remove("dark");
        }

        return activeTheme;
      };

      const syncTheme = () => {
        const themeValue = getStoredTheme();
        const activeMode = applyTheme(themeValue);
        setMode(activeMode);
      };

      syncTheme();

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleMediaChange = () => {
        const themeValue = getStoredTheme();
        if (themeValue === "system") {
          syncTheme();
        }
      };

      mediaQuery.addEventListener("change", handleMediaChange);
      window.addEventListener("themechange", syncTheme);

      return () => {
        mediaQuery.removeEventListener("change", handleMediaChange);
        window.removeEventListener("themechange", syncTheme);
      };
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
