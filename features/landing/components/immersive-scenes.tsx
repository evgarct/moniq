"use client";

import { useRef, type RefObject, type PointerEvent } from "react";
import Image from "next/image";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./immersive.module.css";

type SceneProps = { scrollRef: RefObject<HTMLElement | null> };

export function PerspectiveScene({ scrollRef }: SceneProps) {
  const t = useTranslations("landing.perspective");
  const scene = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef, target: scene, offset: ["start end", "end start"] });
  const aperture = useTransform(scrollYProgress, [0, .28, .5], ["circle(15% at 63% 47%)", "circle(48% at 57% 48%)", "circle(100% at 50% 50%)"]);
  const camera = useTransform(scrollYProgress, [0, .6, 1], [1.01, 1.16, 1.3]);
  const typeY = useTransform(scrollYProgress, [.15, .8], ["12%", "-8%"]);
  const light = useTransform(scrollYProgress, [.1, .6], [.15, 0]);
  return (
    <section ref={scene} className={styles.perspective} id="perspective" data-scene="perspective" aria-labelledby="perspective-title">
      <section className={styles.perspectiveStage}>
        <motion.figure className={styles.archway} style={{ clipPath: aperture }} aria-hidden="true">
          <motion.figure className={styles.archCamera} style={{ scale: camera }}><Image src="/brand/arches.webp" alt="" fill sizes="100vw" /></motion.figure>
          <motion.span className={styles.archShade} style={{ opacity: light }} />
        </motion.figure>
        <motion.section className={styles.perspectiveCopy} style={{ y: typeY }}>
          <p className={styles.sceneLabel}>02 / {t("label")}</p>
          <h2 id="perspective-title">{t("title")}{" "}<em>{t("accent")}</em></h2>
          <p className={styles.perspectiveBody}>{t("body")}</p>
          <a href="#product" className={styles.textLink}>{t("action")}<ArrowDownRight size={20} aria-hidden="true" /></a>
        </motion.section>
        <span className={styles.archCaption}>{t("caption")}</span>
      </section>
    </section>
  );
}

export function BalanceScene({ scrollRef }: SceneProps) {
  const t = useTranslations("landing.balance");
  const scene = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef, target: scene, offset: ["start end", "end start"] });
  const camera = useTransform(scrollYProgress, [0, 1], [1.12, 1]);
  const orbitX = useMotionValue(0);
  const orbitY = useMotionValue(0);
  const x = useSpring(orbitX, { stiffness: 65, damping: 24 });
  const y = useSpring(orbitY, { stiffness: 65, damping: 24 });
  function move(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    orbitX.set((event.clientX - box.left - box.width / 2) * .025);
    orbitY.set((event.clientY - box.top - box.height / 2) * .025);
  }
  return (
    <section ref={scene} className={styles.balance} id="balance" data-scene="balance" aria-labelledby="balance-title" onPointerMove={move} onPointerLeave={() => { orbitX.set(0); orbitY.set(0); }}>
      <figure className={styles.balanceArt} aria-hidden="true">
        <motion.figure className={styles.balancePhoto} style={{ scale: camera }}><Image src="/brand/sphere.webp" alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" /></motion.figure>
        <motion.span className={styles.balanceOrbit} style={{ x, y }} />
        <span className={styles.balanceDot} />
      </figure>
      <section className={styles.balanceCopy}>
        <p className={styles.sceneLabel}>04 / {t("label")}</p>
        <h2 id="balance-title">{t("title")}{" "}<em>{t("accent")}</em></h2>
        <p className={styles.balanceBody}>{t("body")}</p>
        <dl className={styles.balancePrinciples}>
          <dt>{t("plan")}</dt><dd>{t("planBody")}</dd>
          <dt>{t("save")}</dt><dd>{t("saveBody")}</dd>
          <dt>{t("live")}</dt><dd>{t("liveBody")}</dd>
        </dl>
      </section>
      <p className={styles.balanceCaption}>{t("caption")}</p>
    </section>
  );
}

export function FreedomScene() {
  const t = useTranslations("landing");
  return (
    <section className={styles.freedom} id="freedom" data-scene="freedom" aria-labelledby="freedom-title">
      <p className={styles.sceneLabel}>05 / {t("freedom.label")}</p>
      <figure className={styles.freedomWindow} aria-hidden="true"><Image src="/brand/arches.webp" alt="" fill sizes="(min-width: 1024px) 25vw, 55vw" /></figure>
      <section className={styles.freedomCopy}>
        <h2 id="freedom-title">{t("freedom.title")}{" "}<em>{t("freedom.accent")}</em></h2>
        <p>{t("freedom.body")}</p>
        <Link href="/signup" className={styles.primaryLink}>{t("nav.start")}<ArrowUpRight size={20} aria-hidden="true" /></Link>
        <Link href="/login" className={styles.returnLink}>{t("freedom.returning")} <span>{t("nav.login")}</span></Link>
      </section>
      <footer className={styles.colophon}>
        <Link href="/" aria-label={t("nav.home")} className={styles.footerLogo}><svg aria-hidden="true" viewBox="0 0 350 78"><use href="/brand/lockup.svg#lockup" /></svg></Link>
        <p>{t("freedom.colophon")}</p>
        <a href="#opening" className={styles.textLink}>{t("nav.top")}<ArrowUpRight size={16} aria-hidden="true" /></a>
      </footer>
    </section>
  );
}
