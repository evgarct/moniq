# UI Guidelines

Moniq should feel like a polished product workspace, not a generic admin dashboard.

## Direction

- Use a soft light shell with pale neutrals and one restrained green accent.
- Prefer a narrow icon rail for navigation so the content area gets the maximum possible width.
- Let the authenticated app fill the full browser viewport without decorative outer margins.

## Typography

- Use Inter for interface copy and JetBrains Mono only where tabular numeric rhythm helps.
- Keep labels small and quiet.
- Make money values clearly larger and more dominant than their supporting metadata.
- Avoid oversized page titles and stacked bold text.
- Always render money with the wallet currency and use locale-aware formatting for that currency.

## Accounts Surface

- Treat the left rail as a compact wallet register: grouped account rows, fast selection, and inline goal visibility for savings wallets.
- Keep the selected wallet context on the right inside one primary overview card instead of splitting the surface into many competing panels.
- Use the overview card for the dominant balance, lightweight actions, a simple insight placeholder, and recent activity.
- Keep wallet totals, goal amounts, and recent activity easy to scan before adding heavier analytics.

## Visual Rules

- Use soft shadows, soft fills, and thin outlines.
- Prefer rounded outer shells and flatter inner sections.
- Use color intentionally for progress and key actions, not as wallpaper.

## Storybook Review Surface

- Represent Moniq UI in Storybook using atomic layers: atoms, molecules, organisms, templates, and pages.
- Keep stories close to real product layouts so design review happens against realistic screens.
- Treat Storybook as the default place to inspect component states before reviewing the integrated app.
- For finance primitives and wallet flows, include multicurrency states in stories instead of relying on USD-only fixtures.
