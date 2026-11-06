"use client";

import { useRef, useState, type RefObject } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet, Sprout } from "lucide-react";
import { useTranslations } from "next-intl";
import { MoneyAmount } from "@/components/money-amount";
import { Surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import styles from "./immersive.module.css";

// Labeled illustration, never connected to financeSnapshotQueryKey.
const examples = [
  { key: "groceries", account: "daily", amount: -68.4, Icon: ArrowUpRight },
  { key: "salary", account: "daily", amount: 2400, Icon: ArrowDownLeft },
  { key: "coffee", account: "daily", amount: -4.5, Icon: ArrowUpRight },
  { key: "reserve", account: "savings", amount: 300, Icon: ArrowDownLeft },
  { key: "journey", account: "savings", amount: 150, Icon: ArrowDownLeft },
] as const;
type Account = "all" | "daily" | "savings";

export function ProductPreview() {
  const t = useTranslations("landing.product");
  const [account, setAccount] = useState<Account>("all");
  const rows = examples.filter(row => account === "all" || row.account === account);
  const amount = account === "daily" ? 1720 : account === "savings" ? 3100 : 4820;
  const options = [
    { key: "all", amount: 4820, Icon: Landmark },
    { key: "daily", amount: 1720, Icon: Wallet },
    { key: "savings", amount: 3100, Icon: Sprout },
  ] as const;
  return (
    <Surface padding="none" className={styles.productWorkspace}>
      <header className={styles.workspaceHeader}>
        <svg aria-hidden="true" viewBox="0 0 350 78"><use href="/brand/lockup.svg#lockup" /></svg>
        <span>{t("example")}</span><span className={styles.workspaceDot} aria-hidden="true" />
      </header>
      <section className={styles.workspaceBody}>
        <section className={styles.accountInventory} aria-label={t("accounts")}>
          <h3>{t("balance")}</h3>
          <p className={styles.previewTotal}><MoneyAmount amount={4820} currency="EUR" showMinorUnits={false} /></p>
          <p className={styles.inventoryLabel}>{t("accounts")}</p>
          <section className={styles.accountOptions}>
            {options.map(({ key, amount, Icon }) => (
              <Button key={key} variant="ghost" aria-pressed={account === key} onClick={() => setAccount(key)} className={styles.accountOption}>
                <Icon aria-hidden="true" /><span>{t(key)}</span><MoneyAmount amount={amount} currency="EUR" showMinorUnits={false} />
              </Button>
            ))}
          </section>
          <p className={styles.previewHint}>{t("hint")}</p>
        </section>
        <section className={styles.register} aria-live="polite" aria-atomic="true" aria-label={t("register")}>
          <header className={styles.registerHeading}><p>{t(account)}</p><MoneyAmount amount={amount} currency="EUR" showMinorUnits={false} /></header>
          <p className={styles.registerPeriod}>{t("recent")}</p>
          <ul className={styles.registerRows}>
            {rows.map(({ key, amount, Icon }) => (
              <li key={key} className={styles.registerRow}>
                <Icon size={17} strokeWidth={1.4} aria-hidden="true" />
                <span><strong>{t(`rows.${key}.title`)}</strong><small>{t(`rows.${key}.detail`)}</small></span>
                <MoneyAmount amount={amount} currency="EUR" />
              </li>
            ))}
          </ul>
          <footer className={styles.registerFooter}><span>{t("available")}</span><MoneyAmount amount={account === "savings" ? 0 : 1720} currency="EUR" /></footer>
        </section>
      </section>
    </Surface>
  );
}

export function ProductScene({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const t = useTranslations("landing.product");
  const scene = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef, target: scene, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [7, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [64, 0]);
  return (
    <section ref={scene} className={styles.product} id="product" data-scene="product" aria-labelledby="product-title">
      <header className={styles.productTitle}>
        <p className={styles.sceneLabel}>03 / {t("label")}</p>
        <h2 id="product-title">{t("title")}{" "}<em>{t("accent")}</em></h2>
        <p>{t("body")}</p>
      </header>
      <motion.section className={styles.productFrame} style={{ rotateX, y }}><ProductPreview /></motion.section>
      <footer className={styles.productFooter}><p>{t("caption")}</p><Link href="/signup" className={styles.textLink}>{t("action")}<ArrowUpRight size={18} aria-hidden="true" /></Link></footer>
    </section>
  );
}
