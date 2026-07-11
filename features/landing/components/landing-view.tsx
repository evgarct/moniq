"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Globe, 
  Shield, 
  Zap, 
  Sparkles, 
  DollarSign, 
  Wallet,
  Menu,
  X,
  Plus
} from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";

export function LandingView() {
  const t = useTranslations("landing");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [demoTab, setDemoTab] = React.useState<"balance" | "ledger">("balance");
  const [mockTransactions, setMockTransactions] = React.useState([
    { id: 1, title: "Coffee at Stumptown", category: "Food & Drinks", amount: -4.50, currency: "USD", date: "Today" },
    { id: 2, title: "Monthly Salary Deposit", category: "Income", amount: 4200.00, currency: "USD", date: "Today" },
    { id: 3, title: "SaaS Subscription", category: "Software", amount: -19.00, currency: "USD", date: "Yesterday" },
  ]);

  const addMockTransaction = () => {
    const newTx = {
      id: Date.now(),
      title: "Grocery Store Run",
      category: "Groceries",
      amount: -64.20,
      currency: "USD",
      date: "Just now"
    };
    setMockTransactions([newTx, ...mockTransactions]);
  };

  const nextLocale = locale === "en" ? "ru" : "en";
  
  function handleLocaleToggle() {
    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { locale: nextLocale });
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="h-full w-full overflow-y-auto bg-background text-foreground scroll-smooth flex flex-col">
      {/* Top Header/Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Moniq
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.features")}
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.pricing")}
            </a>
            <a href="#mcp" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.mcp")}
            </a>
          </nav>

          {/* Desktop CTA actions */}
          <div className="hidden md:flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleLocaleToggle}
              className="text-xs uppercase tracking-wider rounded-[var(--radius-control)]"
            >
              {locale === "en" ? "RU" : "EN"}
            </Button>
            <Link href="/login">
              <Button variant="ghost">{t("nav.login")}</Button>
            </Link>
            <Link href="/signup">
              <Button variant="default">{t("nav.getStarted")}</Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <div className="flex items-center gap-3 md:hidden">
            <Button
              variant="ghost"
              onClick={handleLocaleToggle}
              className="text-xs uppercase tracking-wider rounded-[var(--radius-control)] h-9 px-2"
            >
              {locale === "en" ? "RU" : "EN"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border/40 bg-background px-6 py-4 flex flex-col gap-4">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("nav.features")}
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("nav.pricing")}
          </a>
          <a
            href="#mcp"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("nav.mcp")}
          </a>
          <div className="h-px bg-border/40 my-2" />
          <div className="flex flex-col gap-2">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-center">
                {t("nav.login")}
              </Button>
            </Link>
            <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="default" className="w-full justify-center">
                {t("nav.getStarted")}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative px-6 pt-16 pb-20 md:pt-24 md:pb-28 max-w-6xl mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-control)] border border-border/40 bg-card mb-6 animate-fade-in">
            <span className="type-body-12 uppercase tracking-[0.15em] font-semibold text-muted-foreground">
              {t("hero.eyebrow")}
            </span>
          </div>

          <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight text-foreground max-w-4xl mb-6 leading-tight">
            {t("hero.title")}
          </h1>

          <p className="type-body-14 text-muted-foreground max-w-2xl mb-8 md:text-lg">
            {t("hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16 w-full sm:w-auto">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button variant="default" size="lg" className="w-full sm:w-auto gap-2">
                {t("hero.cta")} <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#demo" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                {t("hero.secondaryCta")}
              </Button>
            </a>
          </div>

          {/* Elegant Simulated UI Mockup (Strict Design constraints: no card shadow boxes, only surfaces) */}
          <div id="demo" className="w-full border border-border/50 rounded-[24px] bg-card overflow-hidden shadow-2xl p-2 md:p-4 max-w-5xl">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 bg-background rounded-t-[18px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-destructive/60" />
                <span className="w-3 h-3 rounded-full bg-border" />
                <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <span className="text-xs font-mono text-muted-foreground ml-2">Moniq Personal Workspace</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDemoTab("balance")}
                  className={`text-xs px-3 py-1.5 rounded-[var(--radius-control)] transition-all ${
                    demoTab === "balance" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("demo.balanceSheet")}
                </button>
                <button
                  onClick={() => setDemoTab("ledger")}
                  className={`text-xs px-3 py-1.5 rounded-[var(--radius-control)] transition-all ${
                    demoTab === "ledger" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("demo.ledger")}
                </button>
              </div>
            </div>

            <div className="bg-background min-h-[320px] p-6 rounded-b-[18px] text-left">
              {demoTab === "balance" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <span className="type-body-12 uppercase tracking-widest font-semibold text-muted-foreground">
                        {t("demo.netWorth")}
                      </span>
                      <h3 className="text-3xl font-semibold tabular-nums mt-1">$9,309.80</h3>
                    </div>

                    <div className="h-px bg-border/40" />

                    <div className="space-y-4">
                      {/* Cash Assets */}
                      <div>
                        <div className="flex items-center justify-between py-1 hover:bg-secondary/40 px-2 rounded-[var(--radius-control)] transition-all">
                          <div className="flex items-center gap-2">
                            <Wallet className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Cash Wallet</span>
                          </div>
                          <span className="text-sm font-medium tabular-nums">$1,240.00</span>
                        </div>
                      </div>

                      {/* Bank Accounts */}
                      <div>
                        <div className="flex items-center justify-between py-1 hover:bg-secondary/40 px-2 rounded-[var(--radius-control)] transition-all">
                          <div className="flex items-center gap-2">
                            <Wallet className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Checking Account</span>
                          </div>
                          <span className="text-sm font-medium tabular-nums">$3,560.00</span>
                        </div>
                        <div className="flex items-center justify-between py-1 hover:bg-secondary/40 px-2 rounded-[var(--radius-control)] transition-all">
                          <div className="flex items-center gap-2">
                            <Wallet className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Savings Account</span>
                          </div>
                          <span className="text-sm font-medium tabular-nums">$4,860.00</span>
                        </div>
                      </div>

                      {/* Liabilities */}
                      <div>
                        <div className="flex items-center justify-between py-1 hover:bg-secondary/40 px-2 rounded-[var(--radius-control)] transition-all">
                          <div className="flex items-center gap-2">
                            <Wallet className="size-4 text-destructive" />
                            <span className="text-sm font-medium text-destructive">Credit Card</span>
                          </div>
                          <span className="text-sm font-medium tabular-nums text-destructive">-$350.20</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card/40 p-4 rounded-[16px] border border-border/20 flex flex-col justify-between">
                    <div>
                      <h4 className="font-heading text-lg font-bold mb-2">Simulated Live Projections</h4>
                      <p className="type-body-14 text-muted-foreground mb-4">
                        Based on your recurring transfers, bills, and income, your cash flow is forecasted without surprises.
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Estimated July Income</span>
                          <span className="font-medium tabular-nums text-green-600 font-mono">+$4,200.00</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">July Scheduled Expenses</span>
                          <span className="font-medium tabular-nums text-destructive font-mono">-$1,840.00</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-border/40 pt-2 font-medium">
                          <span>Free to Allocate</span>
                          <span className="tabular-nums font-mono">+$2,360.00</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => setDemoTab("ledger")}>
                        View Ledger
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="type-body-12 uppercase tracking-widest font-semibold text-muted-foreground">
                      {t("demo.ledger")}
                    </span>
                    <Button variant="ghost" size="sm" onClick={addMockTransaction} className="gap-1 h-8">
                      <Plus className="size-3.5" /> Add Row
                    </Button>
                  </div>

                  <div className="h-px bg-border/40" />

                  <div className="space-y-1">
                    {mockTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-2.5 px-3 hover:bg-secondary/40 rounded-[var(--radius-control)] transition-all border-b border-border/10 last:border-0"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{tx.title}</span>
                          <span className="text-xs text-muted-foreground">{tx.category}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-xs text-muted-foreground">{tx.date}</span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              tx.amount < 0 ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Divider line */}
        <div className="h-px bg-border/40 w-full" />

        {/* Features Section (Rule-separated Grid, STRICTLY NO CARDS) */}
        <section id="features" className="px-6 py-20 md:py-28 max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight mb-4">
              {t("features.title")}
            </h2>
            <p className="type-body-14 text-muted-foreground md:text-lg">
              {t("features.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-border/40">
            {/* Feature 1 */}
            <div className="p-8 border-r border-b border-border/40 hover:bg-card/30 transition-all group">
              <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                <Globe className="size-6 stroke-[1.75]" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-3">{t("features.multicurrency.title")}</h3>
              <p className="type-body-14 text-muted-foreground text-sm leading-relaxed">
                {t("features.multicurrency.description")}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 border-r border-b border-border/40 hover:bg-card/30 transition-all group">
              <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                <Zap className="size-6 stroke-[1.75]" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-3">{t("features.local.title")}</h3>
              <p className="type-body-14 text-muted-foreground text-sm leading-relaxed">
                {t("features.local.description")}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 border-r border-b border-border/40 hover:bg-card/30 transition-all group">
              <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                <DollarSign className="size-6 stroke-[1.75]" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-3">{t("features.calm.title")}</h3>
              <p className="type-body-14 text-muted-foreground text-sm leading-relaxed">
                {t("features.calm.description")}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 border-r border-b border-border/40 hover:bg-card/30 transition-all group">
              <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                <Sparkles className="size-6 stroke-[1.75]" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-3">{t("features.mcp.title")}</h3>
              <p className="type-body-14 text-muted-foreground text-sm leading-relaxed">
                {t("features.mcp.description")}
              </p>
            </div>
          </div>
        </section>

        {/* Divider line */}
        <div className="h-px bg-border/40 w-full" />

        {/* MCP Spotlight Section */}
        <section id="mcp" className="px-6 py-20 bg-card/20">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="type-body-12 uppercase tracking-[0.2em] font-semibold text-muted-foreground mb-3 block">
                Model Context Protocol
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6 tracking-tight leading-tight">
                Integrate with your AI workflows.
              </h2>
              <p className="type-body-14 text-muted-foreground mb-6 leading-relaxed">
                Moniq includes a built-in MCP server, exposing tools to inspect your balances, search transactions, and track budgets. Let Claude, Cursor, or other AI agents analyze your finances directly in their chat.
              </p>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Shield className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">Zero-trust access control</h4>
                    <p className="text-xs text-muted-foreground">Your API keys remain stored locally and requests are fully auditable.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Sparkles className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">Natural language queries</h4>
                    <p className="text-xs text-muted-foreground">Ask your assistant: &quot;How much did I spend on coffee this week?&quot; or &quot;Run my July net worth projection.&quot;</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/30 rounded-[20px] p-6 font-mono text-xs text-foreground shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
                <span className="text-muted-foreground text-[10px]">MCP Config snippet</span>
                <span className="size-2 rounded-full bg-green-500" />
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-muted-foreground">
{`{
  "mcpServers": {
    "moniq": {
      "command": "npx",
      "args": ["-y", "@moniq/mcp-server"],
      "env": {
        "MONIQ_API_URL": "https://moniq.fyi",
        "MONIQ_API_KEY": "mq_live_..."
      }
    }
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Divider line */}
        <div className="h-px bg-border/40 w-full" />

        {/* Pricing Section (Simple minimal layout, NO CARDS) */}
        <section id="pricing" className="px-6 py-20 md:py-28 max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight mb-4">
              {t("pricing.title")}
            </h2>
            <p className="type-body-14 text-muted-foreground md:text-lg">
              {t("pricing.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60 max-w-4xl mx-auto border-t border-b md:border-l md:border-r border-border/60">
            {/* Free plan */}
            <div className="p-8 md:p-12 flex flex-col justify-between hover:bg-card/20 transition-all">
              <div>
                <span className="type-body-12 uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                  {t("pricing.free.name")}
                </span>
                <div className="flex items-baseline gap-2 mt-4 mb-6">
                  <span className="text-4xl md:text-5xl font-bold font-sans tracking-tight">{t("pricing.free.price")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricing.free.period")}</span>
                </div>
                <div className="h-px bg-border/30 my-6" />
                <ul className="space-y-3.5 mb-8 text-sm">
                  <li className="flex items-center gap-2.5 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    <span>{t("pricing.free.features.wallets")}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    <span>{t("pricing.free.features.history")}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    <span>{t("pricing.free.features.local")}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    <span>{t("pricing.free.features.sync")}</span>
                  </li>
                </ul>
              </div>
              <Link href="/signup">
                <Button variant="outline" className="w-full justify-center">
                  {t("pricing.free.cta")}
                </Button>
              </Link>
            </div>

            {/* Pro plan (Subscribable model) */}
            <div className="p-8 md:p-12 flex flex-col justify-between hover:bg-card/20 transition-all bg-card/10 relative">
              <div className="absolute top-4 right-6 inline-flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                  Stripe Billing
                </span>
              </div>
              <div>
                <span className="type-body-12 uppercase tracking-[0.2em] font-semibold text-muted-foreground flex items-center gap-2">
                  {t("pricing.pro.name")}
                </span>
                <div className="flex items-baseline gap-2 mt-4 mb-6">
                  <span className="text-4xl md:text-5xl font-bold font-sans tracking-tight">{t("pricing.pro.price")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricing.pro.period")}</span>
                </div>
                <div className="h-px bg-border/30 my-6" />
                <ul className="space-y-3.5 mb-8 text-sm">
                  <li className="flex items-center gap-2.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>{t("pricing.pro.features.wallets")}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>{t("pricing.pro.features.history")}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>{t("pricing.pro.features.sync")}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>{t("pricing.pro.features.mcp")}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>{t("pricing.pro.features.stripe")}</span>
                  </li>
                </ul>
              </div>
              <Link href="/signup">
                <Button variant="default" className="w-full justify-center">
                  {t("pricing.pro.cta")}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-6 bg-card/30 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="font-heading text-xl font-bold">Moniq</span>
            <p className="text-xs text-muted-foreground">{t("footer.tagline")}</p>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {t("footer.copyright", { year: String(currentYear) })}
          </div>
        </div>
      </footer>
    </div>
  );
}
