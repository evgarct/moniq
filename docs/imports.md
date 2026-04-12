# Imports

## Goal

The import flow is designed for manual, high-confidence bookkeeping:

1. upload a tabular bank export
2. preview and map the columns
3. store rows as draft imports
4. review each row in the inbox
5. confirm only the rows that are correct

This keeps bank ingestion fast without losing control over categorization and account routing.

## Supported file types

- `.csv`
- `.tsv`
- `.xls`
- `.xlsx`

The parser auto-detects common formats, but the user can always map columns manually before import.

## Required mapping

An import can proceed when it has:

- `date`
- `description`
- either `amount` or `debit/credit`

Optional fields:

- `currency`
- `type`
- `externalId`

The mapping UI defaults to a minimal view and exposes advanced fields on demand.

## Draft inbox model

Imported rows are stored separately from the main finance ledger.

- every uploaded file creates an import batch
- every parsed row becomes a `draft` import transaction
- draft rows are reviewed in `/imports`
- confirmed rows are written into `finance_transactions`
- deleted rows are removed from the draft queue only

The import page only shows batches that still contain draft rows. Once all rows are either confirmed or deleted, the batch disappears from the working list.

## Review actions

Each draft row supports:

- `Expense`
- `Income`
- `Transfer`
- `Debt payment`

Row-specific rules:

- `expense` and `income` require a category
- `transfer` requires both source and destination wallets
- `debt payment` requires a source wallet and a debt wallet

The inbox keeps these controls inline so review stays as close as possible to the normal ledger rhythm.

## Categories

Category selection uses a two-level cascading menu.

- top level shows only parent categories
- parent categories are not directly selectable
- hovering or opening a parent reveals the child category list
- the selected value is rendered as `Parent / Child`

The same cascade picker is shared between the import inbox and the transaction form sheet.

## Merchant cleanup and rules

Each draft row stores:

- raw merchant text from the file
- normalized merchant text for review

The reviewer can still edit merchant text in the detail sheet. When a row is confirmed with a category, Moniq may create or strengthen merchant-based categorization rules for future imports.

## Batch deletion

The user can delete:

- an individual draft row from the inbox
- a whole draft batch from the left-side import pane

Deleting a batch removes the remaining draft imports. Confirmed ledger transactions do not depend on the batch and remain intact.

## Storybook coverage

The inbox review surface is represented by:

- [import-approval-list.stories.tsx](/home/evgenii/projects/moniq-csv-import/features/banking/components/import-approval-list.stories.tsx)

This story is the primary UI review surface for import-row spacing, controls, and category-picking behavior.
