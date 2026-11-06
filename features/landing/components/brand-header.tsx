"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
import styles from "./brand.module.css";

export function BrandHeader({ showLogin = false }: { showLogin?: boolean }) {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const nextLocale = locale === "en" ? "ru" : "en";

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo} aria-label={t("home")}>
        <svg aria-hidden="true" viewBox="0 0 350 78">
          <use href="/brand/lockup.svg#lockup" />
        </svg>
      </Link>
      <nav aria-label={t("label")}>
        {showLogin && <a className={styles.chapterLink} href="#perspective">{t("story")}</a>}
        <Link href={query ? pathname + "?" + query : pathname} locale={nextLocale} hrefLang={nextLocale} aria-label={t("language")}>
          {nextLocale.toUpperCase()}
        </Link>
        {showLogin && <Link className={styles.loginLink} href="/login">{t("login")}</Link>}
        {showLogin && <Link className={styles.startLink} href="/signup">{t("start")}</Link>}
      </nav>
    </header>
  );
}
