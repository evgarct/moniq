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
  Plus,
  Coins
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";

export function LandingView() {
  const t = useTranslations("landing");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">("annual");
  
  const [mockTransactions, setMockTransactions] = React.useState([
    { id: 1, title: "Coffee at Stumptown", category: "Food & Drinks", amount: -4.50, currency: "USD", date: "Today", keyTip: "N" },
    { id: 2, title: "Monthly Salary Deposit", category: "Income", amount: 4200.00, currency: "USD", date: "Today", keyTip: "⌘I" },
    { id: 3, title: "SaaS Subscription", category: "Software", amount: -19.00, currency: "USD", date: "Yesterday", keyTip: "E" },
  ]);

  const addMockTransaction = () => {
    const newTx = {
      id: Date.now(),
      title: "Grocery Store Run",
      category: "Groceries",
      amount: -64.20,
      currency: "USD",
      date: "Just now",
      keyTip: "E"
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
    <div className="h-full w-full overflow-y-auto bg-background text-foreground scroll-smooth flex flex-col relative antialiased selection:bg-secondary">
      
      {/* Blueprint Grid Overlay for Visual Depth */}
      <div 
        style={{ 
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "6rem 6rem"
        }} 
        className="absolute inset-0 opacity-[0.06] pointer-events-none z-0" 
      />

      {/* Top Header/Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-heading text-2xl font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity">
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
        <div className="md:hidden border-b border-border/40 bg-background px-6 py-4 flex flex-col gap-4 z-40 relative">
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
      <main className="flex-1 relative z-10">
        {/* Asymmetric Hero Section */}
        <section className="px-6 pt-16 pb-20 md:pt-24 md:pb-28 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Copy & Actions */}
            <div className="text-left flex flex-col items-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-control)] border border-border/40 bg-card mb-6">
                <span className="type-body-12 uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                  {t("hero.eyebrow")}
                </span>
              </div>

              <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-[1.08] lg:max-w-xl">
                {t("hero.title")}
              </h1>

              <p className="type-body-14 text-muted-foreground max-w-lg mb-8 md:text-base leading-relaxed">
                {t("hero.subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
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
            </div>

            {/* Right Column: High-Fidelity Side-by-Side Product Mockup */}
            <div id="demo" className="w-full border border-border/40 rounded-[24px] bg-card overflow-hidden p-3 md:p-5">
              
              {/* Window chrome header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-border" />
                  <span className="w-2.5 h-2.5 rounded-full bg-border" />
                  <span className="w-2.5 h-2.5 rounded-full bg-border" />
                  <span className="text-[11px] font-mono text-muted-foreground ml-2">moniq.fyi/today</span>
                </div>
                <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-[var(--radius-control)] border border-border/20">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">WORKSPACE</span>
                </div>
              </div>

              {/* Side-by-Side Simulated UI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-5 text-left">
                
                {/* Simulated Left Panel: Account balance tree */}
                <div className="space-y-4 border-r md:border-r border-border/40 pr-0 md:pr-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-muted-foreground">
                      {t("demo.netWorth")}
                    </span>
                    <div className="mt-1">
                      <span className="inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-[0.25em] text-lg font-bold">
                        <span className="justify-self-end tabular-nums">9 309,80</span>
                        <span className="justify-self-center text-[0.8em] opacity-70">$</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-border/30" />

                  {/* Account category rows */}
                  <div className="space-y-2.5">
                    <div className="group/item flex flex-col">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">CASH & BANKS</span>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs hover:text-foreground transition-colors">
                          <span className="text-muted-foreground group-hover/item:text-foreground">Checking</span>
                          <span className="tabular-nums font-medium">$3,560</span>
                        </div>
                        <div className="flex items-center justify-between text-xs hover:text-foreground transition-colors">
                          <span className="text-muted-foreground group-hover/item:text-foreground">Savings</span>
                          <span className="tabular-nums font-medium">$4,860</span>
                        </div>
                      </div>
                    </div>

                    <div className="group/item flex flex-col">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">DEBTS</span>
                      <div className="flex items-center justify-between text-xs text-destructive">
                        <span>Card</span>
                        <span className="tabular-nums font-medium">-$350</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Right Panel: Recent Transactions Ledger */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-muted-foreground">
                      {t("demo.ledger")}
                    </span>
                    <button 
                      onClick={addMockTransaction}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/30 px-2 py-0.5 rounded-[var(--radius-control)] hover:bg-background"
                    >
                      <Plus className="size-3" /> {tCommon("actions.add")}
                    </button>
                  </div>

                  {/* Transaction list */}
                  <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                    {mockTransactions.map((tx) => (
                      <div 
                        key={tx.id}
                        className="group/row flex items-center justify-between p-2 hover:bg-background rounded-[var(--radius-control)] border border-transparent hover:border-border/30 transition-all cursor-pointer relative"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold truncate text-foreground">{tx.title}</span>
                          <span className="text-[10px] text-muted-foreground">{tx.category}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* Keyboard shortcut hint that appears on hover, emphasizing Moniq's operational focus */}
                          <span className="hidden group-hover/row:inline-flex items-center px-1 py-0.5 rounded-[2px] bg-card border border-border/60 text-[8px] font-mono text-muted-foreground tracking-wide select-none">
                            {tx.keyTip}
                          </span>
                          
                          <span className="text-[10px] text-muted-foreground group-hover/row:hidden">{tx.date}</span>
                          
                          {/* MoneyAmount layout mapping */}
                          <span className={`inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-[0.25em] text-xs font-semibold ${
                            tx.amount < 0 ? "text-destructive" : "text-foreground"
                          }`}>
                            <span className="justify-self-end tabular-nums">
                              {tx.amount < 0 ? "-" : ""}{Math.abs(tx.amount).toFixed(2)}
                            </span>
                            <span className="justify-self-center text-[0.8em] opacity-70">$</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground font-mono text-center pt-2">
                    {t("demo.keyboardTip")}
                  </p>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* Divider line */}
        <div className="h-px bg-border/40 w-full" />

        {/* Asymmetric Modular Features Grid */}
        <section id="features" className="px-6 py-20 md:py-28 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight mb-4">
              {t("features.title")}
            </h2>
            <p className="type-body-14 text-muted-foreground md:text-base">
              {t("features.subtitle")}
            </p>
          </div>

          {/* Asymmetric layout grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 border-t border-l border-border/40">
            
            {/* Feature 1: SQLite Sync - Spans 2 Columns */}
            <div className="lg:col-span-2 p-8 border-r border-b border-border/40 hover:bg-card/25 transition-all group flex flex-col justify-between">
              <div>
                <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                  <Zap className="size-6 stroke-[1.75]" />
                </div>
                <h3 className="font-heading text-xl font-bold mb-3">{t("features.local.title")}</h3>
                <p className="type-body-14 text-muted-foreground text-sm leading-relaxed max-w-xl mb-6">
                  {t("features.local.description")}
                </p>
              </div>

              {/* SQLite diagram illustration */}
              <div className="bg-background border border-border/30 rounded-[12px] p-4 font-mono text-[10px] text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 border border-border/30 px-3 py-1.5 rounded-[var(--radius-control)]">
                  <Wallet className="size-3.5 text-muted-foreground" />
                  <span>{t("features.local.sqlite")}</span>
                </div>
                <div className="flex-1 h-px border-t border-dashed border-border/50 text-center relative w-full my-2 sm:my-0">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-background px-2 text-[9px] text-muted-foreground">
                    {t("features.local.sync")}
                  </span>
                </div>
                <div className="flex items-center gap-2 border border-border/30 px-3 py-1.5 rounded-[var(--radius-control)]">
                  <Globe className="size-3.5 text-muted-foreground" />
                  <span>{t("features.local.supabase")}</span>
                </div>
              </div>
            </div>

            {/* Feature 2: Multi-Currency Tracking - Spans 1 Column */}
            <div className="p-8 border-r border-b border-border/40 hover:bg-card/25 transition-all group flex flex-col justify-between">
              <div>
                <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                  <Coins className="size-6 stroke-[1.75]" />
                </div>
                <h3 className="font-heading text-xl font-bold mb-3">{t("features.multicurrency.title")}</h3>
                <p className="type-body-14 text-muted-foreground text-sm leading-relaxed mb-6">
                  {t("features.multicurrency.description")}
                </p>
              </div>

              {/* Currency Balance stack mockup */}
              <div className="space-y-2 border-t border-border/20 pt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Euro Wallet</span>
                  <span className="font-semibold tabular-nums">4 820,00 €</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">US Dollar checking</span>
                  <span className="font-semibold tabular-nums">$3,560.00</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Ruble Cash</span>
                  <span className="font-semibold tabular-nums">120 000 ₽</span>
                </div>
              </div>
            </div>

            {/* Feature 3: AI Integration - Spans 1 Column */}
            <div className="p-8 border-r border-b border-border/40 hover:bg-card/25 transition-all group flex flex-col justify-between">
              <div>
                <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                  <Sparkles className="size-6 stroke-[1.75]" />
                </div>
                <h3 className="font-heading text-xl font-bold mb-3">{t("features.mcp.title")}</h3>
                <p className="type-body-14 text-muted-foreground text-sm leading-relaxed mb-6">
                  {t("features.mcp.description")}
                </p>
              </div>

              {/* Mock dialogue */}
              <div className="bg-background border border-border/20 rounded-[12px] p-3 text-xs space-y-2 font-mono">
                <div className="text-[10px] text-muted-foreground">&gt; {t("features.mcp.sub2Title")}</div>
                <div className="bg-card/50 p-2 rounded-[4px] border border-border/20 text-muted-foreground leading-relaxed text-[10px]">
                  &quot;Your net worth across 3 wallets increased by 4.2% this month.&quot;
                </div>
              </div>
            </div>

            {/* Feature 4: Calm Budgeting & Savings Plans - Spans 2 Columns */}
            <div className="lg:col-span-2 p-8 border-r border-b border-border/40 hover:bg-card/25 transition-all group flex flex-col justify-between">
              <div>
                <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-4">
                  <DollarSign className="size-6 stroke-[1.75]" />
                </div>
                <h3 className="font-heading text-xl font-bold mb-3">{t("features.calm.title")}</h3>
                <p className="type-body-14 text-muted-foreground text-sm leading-relaxed max-w-xl mb-6">
                  {t("features.calm.description")}
                </p>
              </div>

              {/* Allocation bars mockup */}
              <div className="space-y-4 border-t border-border/20 pt-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Emergency Fund</span>
                    <span className="font-medium">60% ($3,000 / $5,000)</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div style={{ width: "60%" }} className="h-full bg-chart-1" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Vacation Travel</span>
                    <span className="font-medium">90% ($1,800 / $2,000)</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div style={{ width: "90%" }} className="h-full bg-chart-2" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Divider line */}
        <div className="h-px bg-border/40 w-full" />

        {/* MCP Spotlight Section */}
        <section id="mcp" className="px-6 py-20 bg-card/20 relative">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
            
            <div>
              <span className="type-body-12 uppercase tracking-[0.2em] font-semibold text-muted-foreground mb-3 block">
                {t("features.mcp.title")}
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6 tracking-tight leading-tight">
                Integrate with your AI workflows.
              </h2>
              <p className="type-body-14 text-muted-foreground mb-8 leading-relaxed">
                {t("features.mcp.description")}
              </p>
              <div className="space-y-5">
                <div className="flex gap-3">
                  <Shield className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">{t("features.mcp.sub1Title")}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t("features.mcp.sub1Desc")}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Sparkles className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">{t("features.mcp.sub2Title")}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t("features.mcp.sub2Desc")}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/30 rounded-[20px] p-6 font-mono text-xs text-foreground shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
                <span className="text-muted-foreground text-[10px]">{t("features.mcp.terminalLabel")}</span>
                <span className="size-2 rounded-full bg-green-500" />
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-muted-foreground text-[11px]">
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
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight mb-4">
              {t("pricing.title")}
            </h2>
            <p className="type-body-14 text-muted-foreground md:text-base">
              {t("pricing.subtitle")}
            </p>
          </div>

          {/* Interactive Pricing Toggle with Discount Badge */}
          <div className="flex items-center justify-center gap-3 mb-16 select-none">
            <button 
              onClick={() => setBillingCycle("monthly")}
              className={`text-xs font-semibold px-4 py-2 rounded-[var(--radius-control)] border transition-all ${
                billingCycle === "monthly" 
                  ? "bg-primary text-primary-foreground border-transparent" 
                  : "bg-background text-muted-foreground border-border/40 hover:bg-card"
              }`}
            >
              {t("pricing.monthly")}
            </button>
            <button 
              onClick={() => setBillingCycle("annual")}
              className={`text-xs font-semibold px-4 py-2 rounded-[var(--radius-control)] border transition-all flex items-center gap-1.5 ${
                billingCycle === "annual" 
                  ? "bg-primary text-primary-foreground border-transparent" 
                  : "bg-background text-muted-foreground border-border/40 hover:bg-card"
              }`}
            >
              {t("pricing.annual")}
              <span className="text-[9px] uppercase font-mono bg-destructive/15 text-destructive border border-destructive/20 px-1 rounded">
                {t("pricing.save20")}
              </span>
            </button>
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

            {/* Pro plan (Subscribable model mapped to billingCycle) */}
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
                
                {/* Dynamically toggle rates based on annual vs monthly billing cycle selection */}
                <div className="flex items-baseline gap-2 mt-4 mb-6 transition-all duration-300">
                  <span className="text-4xl md:text-5xl font-bold font-sans tracking-tight">
                    {billingCycle === "annual" ? t("pricing.pro.priceAnnual") : t("pricing.pro.priceMonthly")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {billingCycle === "annual" ? t("pricing.pro.periodAnnual") : t("pricing.pro.periodMonthly")}
                  </span>
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
      <footer className="border-t border-border/40 py-12 px-6 bg-card/30 mt-auto relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="font-heading text-xl font-bold animate-pulse">Moniq</span>
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
