"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchLocale(nextLocale: AppLocale) {
    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    router.replace(href, { locale: nextLocale });
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("label")}</p>
      <div className="flex gap-2">
        {routing.locales.map((item) => (
          <Button
            key={item}
            type="button"
            variant={item === locale ? "secondary" : "ghost"}
            size="sm"
            className="rounded-xl"
            onClick={() => switchLocale(item)}
          >
            {t(item)}
          </Button>
        ))}
      </div>
    </div>
  );
}
