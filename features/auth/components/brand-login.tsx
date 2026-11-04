import type { ReactNode } from "react";

import { BrandHeader } from "@/features/landing/components/brand-header";
import { BrandScene } from "@/features/landing/components/brand-scene";
import brand from "@/features/landing/components/brand.module.css";
import styles from "@/features/landing/components/journey.module.css";

export function BrandLogin({ children }: { children: ReactNode }) {
  return (
    <main className={brand.page + " " + styles.page}>
      <BrandHeader />
      <section className={styles.loginGrid}>
        <section className={styles.loginForm}>{children}</section>
        <section className={styles.loginArt} aria-hidden="true">
          <span className={styles.loginDisc} />
          <BrandScene scene="login" className={styles.rive} />
          <span className={styles.frame} />
        </section>
      </section>
    </main>
  );
}
