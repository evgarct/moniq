---
name: Product context - moniq
description: Product-level context for Impeccable design work in the Moniq repository.
type: reference
---

# Product Context

## Register

product

## Product Purpose

Moniq is a personal finance workspace for managing accounts, transactions, budgets, cashflow, goals, imports, and related financial structure. The interface should make repeated financial review and data entry feel calm, precise, and trustworthy.

## Users

- People maintaining their own day-to-day finances across wallets, accounts, debts, savings, and categories.
- Users who need to scan dense financial state quickly, compare amounts, and enter or correct transactions without visual noise.
- Users who value reliability and clarity over decorative novelty.

## Product Tone

Calm, editorial, restrained, and operational. The product should feel like a quiet finance workspace: warm, precise, and deliberate. Visual interest comes from hierarchy, spacing, typography, and exact alignment, not from saturated UI color or decorative containers.

## Strategic Design Principles

- Design serves the task. Use familiar product patterns, predictable grids, and dense but readable information.
- Warm neutrals carry the surface. Most UI should use background, card, secondary, popover, border, foreground, and muted tokens.
- Financial data needs alignment discipline. Amounts, currencies, row labels, and secondary metadata should scan cleanly.
- Rows are the primary language for repeated data. Avoid card-per-item layouts, chips, icon badges, and colored metadata containers.
- Surfaces are for major regions only. Use the shared `Surface` primitive instead of rebuilding shadows, borders, or rounded containers locally.
- Forms should feel spatial and focused. Structured create/edit flows belong in sheets; confirmation decisions can use dialogs.
- Copy must be localized through `next-intl` and stay direct. Avoid explanatory UI copy when the structure already teaches the action.

## Anti-References

- Generic fintech dashboards with navy, gold, neon green, or crypto-style glow.
- SaaS card grids, badge-heavy metadata, and icon-in-circle list rows.
- Decorative gradients, glassmorphism, oversized hero metrics, or motion that does not communicate state.
- Bright Tailwind semantic colors used as ordinary interface accents.
