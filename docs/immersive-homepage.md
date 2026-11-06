# Moniq: a clearer view

## Direction

The public homepage is a spatial exhibition in warm daylight: monumental stone,
paper, a terracotta sun and the existing Architectural M. The five supplied brand
sheets are preserved in `public/brand-reference/`. They guide the composition;
they are not embedded as website screenshots. Existing `public/brand` photographs
and the traced lockup are reused. PT Serif and Inter retain the public identity.

The inspiration sites were inspected in a browser. Their relevant qualities are
object-led storytelling, tactile scale, depth that responds to scrolling, and an
interaction that changes what the visitor sees. Their layouts and assets are not
copied.

## Scene score

| Scene | Composition | Camera and transition | Purpose |
| --- | --- | --- | --- |
| 01 Opening | Oversized editorial title on ivory; cropped monumental bust, terracotta disc and thin orbital line | Slow counter-motion of stone and type. The disc holds the vanishing point for the next scene | Immediate registration and sign-in; human perspective |
| 02 Perspective | Repeating limestone arches fill the screen, with a quiet caption and large foreground title | Circular aperture expands into the architecture; a restrained forward camera move resolves the depth | See accounts, commitments and plans in context |
| 03 Clarity | A working, explicitly illustrative Balance workspace in the product's row language | The frame straightens and settles; selecting an account filters its register | Show a real product interaction without production data or invented features |
| 04 Balance | A lit stone sphere, architectural cropping and oversized type | Fine pointer response on a framing ring; the stone stays grounded | Connect budgets, goals and available money to balance |
| 05 Freedom | Open ivory, a narrow architectural opening and generous negative space | Motion comes to rest. A single strong registration action concludes the journey | Enter the existing product |

## Implementation boundaries

- Preserve Next.js App Router, next-intl routing and Supabase authentication.
  Signed-in visitors retain the existing redirect into the app.
- Use existing Framer Motion and native scrolling. No scroll hijacking, WebGL,
  new animation runtime or image-generation dependency is needed.
- Cinematic masks and photographs are a bespoke brand composition. Product
  controls continue to use the shared UI primitives, `Surface`, `MoneyAmount`
  and the established row/register structure. No cards per item or chips.
- The landing `main` owns scrolling. Sticky scenes are independent of the app
  shell. All public UI copy uses the `landing` translation namespace.
- Mobile is a separate composition below 1024px: shorter scenes, carefully
  cropped stone, readable copy and persistent access to authentication.
- Reduced motion removes pinning, camera travel and pointer effects. Every
  scene remains readable in document order with static photography. No-JS
  visitors retain the narrative, navigation and authentication links.
- The product demonstration is synthetic, labeled and local to the marketing
  component. All values are EUR. Selecting an account only filters the sample
  register; it never reads or writes the live financial snapshot.

## Review surfaces

Develop the opening in an isolated Storybook state before integrating the five
scenes. Maintain desktop, mobile, each chapter, the product interaction and a
static-motion state. Save browser captures under `.codex-artifacts/immersive-home`.

Verification covers story interactions, browser console/network, desktop/mobile
geometry, reverse scrolling, keyboard focus, both locales, reduced motion,
authentication entry destinations, TypeScript and production build. Record the
final results here before publication.

## Verified delivery

- Standalone TypeScript, production Next.js build, ESLint (no errors), design
  guard and Storybook-first guard passed. ESLint retains five pre-existing image
  warnings in the unrelated branding foundation story.
- All 478 unit tests and the full Storybook suite passed. The landing's nine stories
  enforce WCAG contrast errors rather than treating accessibility as advisory.
- `test:e2e:landing` passed against `next start`: 320, 360 and 390px mobile,
  1366, 1440 and 1920px desktop, English/Russian, reduced motion, reverse scroll,
  keyboard account filtering, accessibility and JavaScript-disabled navigation.
- The real login and signup forms were reached through the marketing actions.
  The dedicated synthetic account signed in to Inbox, and a settled signed-in
  session opening the homepage redirected to Today.
- Production PWA verification passed, including its cached offline fallback.
- Browser captures for every scene and each tested configuration are retained
  in `.codex-artifacts/immersive-home/`; `verification.json` is the repeatable
  landing smoke report. The app owns the scroll container and console output
  shows no introduced runtime or hydration failures.

No additional visual assets or production secrets are required. The preview is
an intentionally illustrative subset of Balance, not a second implementation of
the application's finance model. On local production previews the two optional
Vercel Analytics scripts return 404; the smoke excludes only those exact hosted
endpoints, following the existing authenticated-app test convention. Hindsight
was unavailable during the audit (connection timeout), so decisions were checked
against the current repository and supplied references.

The product preview pins its selected and hovered account background to the
scoped light palette, including when the application preference is dark.
`DarkPreference` and the desktop/mobile dark-preference browser runs cover this
boundary; the rest of the application keeps its own theme.

The Vercel branch Preview builds, but its server returns 500 because that
environment lacks `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. These are configured separately from local and
Production environments. Preview runtime acceptance is blocked by those inputs;
the local `next start` acceptance remains valid. Production data is not copied
into Preview to work around the missing staging configuration.

The retrospective added standing checks for dark-scene text inheritance and
HTTP-first preview reuse. Existing design and verification skills were sufficient;
no new skill or animation dependency was needed.
