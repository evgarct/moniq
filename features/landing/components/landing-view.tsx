"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PointerEvent } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { BrandHeader } from "./brand-header";
import { BrandScene } from "./brand-scene";
import styles from "./brand.module.css";

function moveHeroLight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const frame = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - frame.left) / frame.width - 0.5;
  const y = (event.clientY - frame.top) / frame.height - 0.5;
  event.currentTarget.style.setProperty("--hero-x", x.toFixed(3));
  event.currentTarget.style.setProperty("--hero-y", y.toFixed(3));
}

export function LandingView() {
  const t = useTranslations("landing");
  const locale = useLocale();

  return (
    <main className={styles.page} lang={locale}>
      <section className={styles.hero} aria-labelledby="brand-title">
        <section className={styles.heroStage} onPointerMove={moveHeroLight}
          onPointerLeave={(event) => {
            event.currentTarget.style.removeProperty("--hero-x");
            event.currentTarget.style.removeProperty("--hero-y");
          }}
        >
          <BrandHeader showLogin />
          <figure className={styles.sculpture} aria-hidden="true">
            <span className={styles.sun} />
            <span className={styles.bust} />
          </figure>
          <BrandScene scene="hero" className={styles.heroArt} />
          <header className={styles.heroText}>
            <p className={styles.eyebrow}>{t("hero.kicker")}</p>
            <h1 id="brand-title">
              <span><span>{t("hero.title")}</span></span>
              <span><em>{t("hero.accent")}</em></span>
            </h1>
            <p className={styles.lede}>{t("hero.body")}</p>
          </header>
          <footer className={styles.heroFoot}>
            <a className={styles.textLink} href="#perspective">
              <ArrowDown size={18} aria-hidden="true" /> {t("hero.explore")}
            </a>
            <p className={styles.plate}>{t("hero.plate")}</p>
          </footer>
        </section>
      </section>
      <section className={styles.forecast} id="perspective">
        <header>
          <p className={styles.eyebrow}>{t("forecast.kicker")}</p>
          <h2>{t("forecast.title")}</h2>
        </header>
        <BrandScene scene="forecast" className={styles.forecastArt} />
        <dl className={styles.featureList}>
          <dt>{t("forecast.modelTitle")}</dt>
          <dd>{t("forecast.modelBody")}</dd>
          <dt>{t("forecast.balanceTitle")}</dt>
          <dd>{t("forecast.balanceBody")}</dd>
        </dl>
      </section>
      <section className={styles.ai} id="assistants">
        <svg className={styles.aiGraphic} viewBox="0 0 400 400" aria-hidden="true">
          <circle cx="200" cy="200" r="36" fill="currentColor" />
          <path d="M24 200a176 176 0 0 1 352 0M56 200a144 144 0 0 1 288 0M88 200a112 112 0 0 1 224 0M24 200a176 176 0 0 0 352 0M56 200a144 144 0 0 0 288 0" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        <header>
          <p className={styles.eyebrow}>{t("ai.kicker")}</p>
          <h2>{t("ai.title")}</h2>
          <p className={styles.lede}>{t("ai.body")}</p>
        </header>
        <ul className={styles.questions}>
          <li>{t("ai.questionOne")}</li>
          <li>{t("ai.questionTwo")}</li>
          <li>{t("ai.questionThree")}</li>
        </ul>
      </section>
      <section className={styles.values} id="values">
        <header>
          <p className={styles.eyebrow}>{t("values.kicker")}</p>
          <h2>{t("values.title")}</h2>
        </header>
        <figure className={styles.valuesArt} aria-hidden="true" />
        <dl className={styles.featureList}>
          <dt>{t("values.clarity")}</dt><dd>{t("values.clarityBody")}</dd>
          <dt>{t("values.stability")}</dt><dd>{t("values.stabilityBody")}</dd>
          <dt>{t("values.freedom")}</dt><dd>{t("values.freedomBody")}</dd>
        </dl>
      </section>
      <footer className={styles.footer}>
        <p>{t("closing")}</p>
        <Link className={styles.textLink} href="/login">{t("nav.login")} <ArrowRight size={16} aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
