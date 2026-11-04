"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { BrandHeader } from "./brand-header";
import { BrandScene } from "./brand-scene";
import brand from "./brand.module.css";
import styles from "./journey.module.css";

export function LandingView() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const page = useRef<HTMLElement>(null);
  const journey = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    container: page,
    target: journey,
    offset: ["start start", "end end"],
  });
  // Share the same sampled scroll value with DOM layers and Rive.
  const progress = useTransform(() => scrollYProgress.get());
  const portrait = useTransform(progress, [0, 0.12, 0.32], [1, 1, 0]);
  const architecture = useTransform(progress, [0.1, 0.32, 0.43, 0.61], [0, 1, 1, 0]);
  const aperture = useTransform(progress, [0.1, 0.32, 0.61], [
    "circle(12% at 54% 39%)", "circle(62% at 50% 50%)", "circle(73% at 50% 50%)",
  ]);
  const dialogue = useTransform(progress, [0.42, 0.65, 0.74, 0.9], [0, 1, 1, 0]);
  const stillLife = useTransform(progress, [0.72, 0.96], [0, 1]);
  const camera = useTransform(progress, [0, 0.33, 0.66, 1], [1, 1.17, 1.05, 1.23]);
  const discScale = useTransform(progress, [0, 0.32, 0.65, 1], [1, 2.3, 0.34, 0.62]);
  const discX = useTransform(progress, [0, 0.32, 0.65, 1], ["4%", "-12%", "0%", "19%"]);
  const discY = useTransform(progress, [0, 0.32, 0.65, 1], ["-11%", "4%", "0%", "24%"]);
  const ringRotation = useTransform(progress, [0, 1], [-32, 112]);
  const dash = useTransform(progress, [0, 0.33, 0.66, 1], [0.88, 0.35, 0.08, 0]);
  const forecast = useTransform(progress, [0.12, 0.43], [0, 100]);

  return (
    <main ref={page} className={brand.page + " " + styles.page} lang={locale}>
      <div className={styles.masthead}><BrandHeader showLogin /></div>
      <section ref={journey} className={styles.journey} aria-label={t("nav.story")}>
        <figure className={styles.stage} aria-hidden="true">
          <motion.div className={styles.artwork} style={{ scale: camera }}>
            <motion.span className={styles.disc} style={{ x: discX, y: discY, scale: discScale }} />
            <motion.span className={styles.portrait} style={{ opacity: portrait }} />
              <motion.div className={styles.architecture} style={{ opacity: architecture, clipPath: aperture }}>
                <BrandScene scene="forecast" className={styles.rive} progress={forecast} />
              </motion.div>
              <motion.span className={styles.dialogue} style={{ opacity: dialogue }} />
              <motion.span className={styles.stillLife} style={{ opacity: stillLife }} />
              <motion.svg className={styles.orbits} viewBox="0 0 600 600" style={{ rotate: ringRotation }}>
                <motion.path d="M75 300a225 225 0 0 1 450 0M107 300a193 193 0 0 1 386 0M141 300a159 159 0 0 1 318 0M75 300a225 225 0 0 0 450 0" pathLength="1" style={{ strokeDashoffset: dash }} />
              </motion.svg>
              <motion.span className={styles.axis} style={{ scaleX: progress }} />
          </motion.div>
          <motion.div className={styles.heroRive} style={{ opacity: portrait }}>
            <BrandScene scene="hero" className={styles.rive} />
          </motion.div>
          <span className={styles.frame} />
        </figure>
        <div className={styles.chapters}>
          <section className={styles.chapter} aria-labelledby="brand-title">
            <p className={brand.eyebrow}>{t("hero.kicker")}</p>
            <h1 id="brand-title">{t("hero.title")} <em>{t("hero.accent")}</em></h1>
            <p className={styles.lede}>{t("hero.body")}</p>
            <a className={styles.chapterLink} href="#perspective">{t("hero.explore")} <ArrowDown size={17} aria-hidden="true" /></a>
          </section>
          <section className={styles.chapter} id="perspective">
            <p className={brand.eyebrow}>{t("forecast.kicker")}</p>
            <h2>{t("forecast.title")}</h2>
            <dl className={styles.details}>
              <dt>{t("forecast.modelTitle")}</dt><dd>{t("forecast.modelBody")}</dd>
              <dt>{t("forecast.balanceTitle")}</dt><dd>{t("forecast.balanceBody")}</dd>
            </dl>
          </section>
          <section className={styles.chapter} id="assistants">
            <p className={brand.eyebrow}>{t("ai.kicker")}</p>
            <h2>{t("ai.title")}</h2>
            <p className={styles.lede}>{t("ai.body")}</p>
            <ul className={styles.prompts}>
              <li>{t("ai.questionOne")}</li>
              <li>{t("ai.questionTwo")}</li>
              <li>{t("ai.questionThree")}</li>
            </ul>
          </section>
          <section className={styles.chapter} id="values">
            <p className={brand.eyebrow}>{t("values.kicker")}</p>
            <h2>{t("values.title")}</h2>
            <dl className={styles.details}>
              <dt>{t("values.clarity")}</dt><dd>{t("values.clarityBody")}</dd>
              <dt>{t("values.stability")}</dt><dd>{t("values.stabilityBody")}</dd>
              <dt>{t("values.freedom")}</dt><dd>{t("values.freedomBody")}</dd>
            </dl>
            <Link className={styles.chapterLink} href="/login">{t("nav.login")} <ArrowRight size={17} aria-hidden="true" /></Link>
          </section>
        </div>
      </section>
    </main>
  );
}
