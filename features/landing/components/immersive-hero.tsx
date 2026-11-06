"use client";

import { useRef, type RefObject } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import styles from "./immersive.module.css";

export function ImmersiveHero({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const t = useTranslations("landing");
  const scene = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef, target: scene, offset: ["start start", "end start"] });
  const stoneY = useTransform(scrollYProgress, [0, 0.75], ["0%", "-12%"]);
  const stoneScale = useTransform(scrollYProgress, [0, 0.75], [1, 1.12]);
  const titleY = useTransform(scrollYProgress, [0, 0.6], ["0%", "-22%"]);
  const sunScale = useTransform(scrollYProgress, [0, 0.7], [1, 1.32]);

  return (
    <section ref={scene} className={styles.hero} id="opening" aria-labelledby="brand-title" data-scene="opening">
      <section className={styles.heroStage}>
        <p className={styles.heroIndex}>{t("hero.kicker")}</p>
        <figure className={styles.heroArt} aria-hidden="true">
          <motion.span className={styles.heroSun} style={{ scale: sunScale }} />
          <span className={styles.heroOrbit} />
          <motion.figure className={styles.heroStone} style={{ y: stoneY, scale: stoneScale }}>
            <Image src="/brand/manifesto.webp" alt="" fill sizes="(min-width: 1024px) 57vw, 100vw" preload />
          </motion.figure>
          <span className={styles.heroHalftone} />
        </figure>
        <motion.section className={styles.heroCopy} style={{ y: titleY }}>
          <h1 id="brand-title"><span>{t("hero.lineOne")}</span>{" "}<span>{t("hero.lineTwo")}</span>{" "}<em>{t("hero.accent")}</em></h1>
          <section className={styles.heroIntro}>
            <p>{t("hero.body")}</p>
            <Link href="/signup" className={styles.primaryLink}>{t("nav.start")}<ArrowUpRight size={19} aria-hidden="true" /></Link>
          </section>
        </motion.section>
        <footer className={styles.heroFooter}>
          <a href="#perspective" className={styles.scrollLink}><ArrowDown size={17} aria-hidden="true" />{t("hero.explore")}</a>
          <span>{t("hero.caption")}</span>
          <span className={styles.sceneCount}>01 / 05</span>
        </footer>
      </section>
    </section>
  );
}
