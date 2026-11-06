"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BrandHeader } from "./brand-header";
import { ImmersiveHero } from "./immersive-hero";
import { PerspectiveScene, BalanceScene, FreedomScene } from "./immersive-scenes";
import { ProductScene } from "./product-scene";
import brand from "./brand.module.css";
import styles from "./immersive.module.css";

export function LandingView() {
  const page = useRef<HTMLElement>(null);
  const locale = useLocale();
  const t = useTranslations("landing");
  return (
    <main ref={page} className={`${brand.page} ${styles.page}`} lang={locale}>
      <a className={styles.skipLink} href="#product">{t("nav.skip")}</a>
      <section className={styles.masthead}><BrandHeader showLogin /></section>
      <ImmersiveHero scrollRef={page} />
      <PerspectiveScene scrollRef={page} />
      <ProductScene scrollRef={page} />
      <BalanceScene scrollRef={page} />
      <FreedomScene />
    </main>
  );
}
