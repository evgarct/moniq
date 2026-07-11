"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Palette } from "lucide-react";

import { Surface, SurfaceDescription, SurfaceEyebrow, SurfaceHeader } from "@/components/surface";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ThemeValue = "light" | "dark" | "system";

export function ThemeSettings() {
  const t = useTranslations("settings.theme");
  const [theme, setTheme] = useState<ThemeValue>("system");
  const [mounted, setMounted] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(stored);
      }
    } catch {}
    setMounted(true);
  }, []);

  const handleThemeChange = (value: ThemeValue) => {
    setTheme(value);
    try {
      localStorage.setItem("theme", value);
      document.cookie = `theme=${value}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}

    // Dispatch custom event to notify AppProviders
    window.dispatchEvent(new Event("themechange"));

    // Show visual confirmation
    setShowSaved(true);
  };

  // Hide the confirmation after a delay when it triggers
  useEffect(() => {
    if (showSaved) {
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSaved]);

  if (!mounted) {
    return (
      <Surface tone="panel" padding="lg">
        <div className="flex items-start gap-3">
          <Palette className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <SurfaceHeader className="mb-5 px-0">
              <div className="flex flex-col gap-1">
                <SurfaceEyebrow>{t("eyebrow")}</SurfaceEyebrow>
                <h2 className="type-h5 text-foreground">{t("title")}</h2>
                <SurfaceDescription>{t("description")}</SurfaceDescription>
              </div>
            </SurfaceHeader>
            <div className="h-10 w-full sm:w-[240px] bg-background animate-pulse rounded-[var(--radius-control)]" />
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <Surface tone="panel" padding="lg">
      <div className="flex items-start gap-3">
        <Palette className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <SurfaceHeader className="mb-5 px-0">
            <div className="flex flex-col gap-1">
              <SurfaceEyebrow>{t("eyebrow")}</SurfaceEyebrow>
              <h2 className="type-h5 text-foreground">{t("title")}</h2>
              <SurfaceDescription>{t("description")}</SurfaceDescription>
            </div>
          </SurfaceHeader>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="theme-select" className="type-body-12 font-medium text-foreground">
                {t("fieldLabel")}
              </label>
              <Select value={theme} onValueChange={(val) => handleThemeChange(val as ThemeValue)}>
                <SelectTrigger id="theme-select" className="w-full sm:w-[240px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="light">{t("options.light")}</SelectItem>
                  <SelectItem value="dark">{t("options.dark")}</SelectItem>
                  <SelectItem value="system">{t("options.system")}</SelectItem>
                </SelectContent>
              </Select>
              {showSaved ? (
                <p className="type-body-12 text-muted-foreground transition-opacity duration-300">
                  {t("saved")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}
