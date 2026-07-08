## Summary

- replace the projected balance dependency with a responsive white-label SVG chart and persistent report preferences
- standardize mobile page-header actions and fix Today and Balance header geometry, hit areas, and investment navigation
- simplify Budget into one default-currency timeline, row-based category sections, and an explicit category-management workspace
- add unit and Storybook coverage for report preferences/geometry, FX conversion, missing rates, and mobile states

## Verification

- `npx tsc --noEmit`
- `npm run lint:code -- --ignore-pattern .claude/**`
- `npm run check:design-system`
- `npm run test:unit`
- `npm run test-storybook`
- `npm run build-storybook`
- `npm run build`
- `npm run test:e2e:auth`
- authenticated browser smoke: Today, Balance, Budget, Projected balance
- DevTools geometry, overflow, console, network, tooltip, and attribution checks
