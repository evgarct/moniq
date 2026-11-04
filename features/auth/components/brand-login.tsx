import type { ReactNode } from "react";

import { BrandHeader } from "@/features/landing/components/brand-header";
import { BrandScene } from "@/features/landing/components/brand-scene";
import styles from "@/features/landing/components/brand.module.css";

export function BrandLogin({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <BrandHeader />
      <section className={styles.loginGrid}>
        <section className={styles.loginForm}>{children}</section>
        <BrandScene scene="login" className={styles.loginArt} />
      </section>
    </main>
  );
}