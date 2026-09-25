# PR #96 — Browser verification, 2026-09-25

## Scope and decision

Status: **ISOLATED COMPONENT BROWSER VERIFIED**. This is not a production deployment, live-data, authentication, device-keyboard, or Design Hub conformance approval. Keep PR #96 Draft; do not infer merge/deployment permission from this receipt.

Tested code HEAD: `ee7177d6792624e0e527ffaa2afb4d4d9a3c7fb9`.
GitHub Actions tested merge checkout: `86a7d9c695a283de270fc7ff9638945212bf759b`.
Browser: Chromium `140.0.7339.16`, headless, `ko-KR`, height 900 CSS pixels.

## Measured defects and fixes

The first browser probe found issues that the existing source-pattern checks did not detect:

1. Desktop offer conditions were ellipsized or reduced to zero width. At 901px, two condition spans needed 211px but received 0px. Deposit, prepayment and mileage were therefore not reliably visible.
2. Product-value segments extended outside their row in narrow desktop intake panels at 901px and 1024px.
3. At 320px, the picked-product summary still had two columns: a later 900px CSS rule overrode the earlier narrow-screen rule.

Fix ownership: `src/app/_design/responsive-layout.css`, imported once after the existing layers by `src/app/layout.tsx`.

- Product-card reflow is based on the card's own available inline size, using a named container query, rather than the window breakpoint alone.
- Values may wrap by phrase in a narrow card, rather than overlapping or disappearing.
- Offer conditions remain fully rendered without ellipsis. A compact additional line is used when space is insufficient; wide offer containers can share the line again.
- Picked summaries use an intrinsic auto-fit grid, preserving a single column at 320px and adapting to narrow desktop panels.
- Existing colours, typography tokens, state machines, calculations and database bindings are unchanged.

## Browser harness and evidence integrity

Files:
- `scripts/browser/fixture.tsx`
- `scripts/check-ui-browser.mjs`
- `.github/workflows/ui-browser-check.yml`

The fixture imports the actual ListRow, OfferPicker, DetailTabs, ActionBar and summary primitives. It uses synthetic vehicle/offer values only. The picked-summary markup is a test fixture; it does not execute NewIntakePanel's server/data logic.

Next Link is replaced only at the navigation boundary with an anchor. Next routing/prefetch is therefore not part of this receipt. All non-local browser requests are blocked, and none were observed. No service-account credentials are supplied. `ERP5_WRITE=off`.

The verifier derives stylesheet order directly from the production root layout:
1. `src/app/globals.css`
2. `src/app/_design/admin-final.css`
3. `src/app/_fn/fn.css`
4. `src/app/_design/responsive-layout.css`

The first diagnostic probe loaded the first two stylesheets; the final verification loads the complete production import order above. The harness also waits for the observable offer-link update after React's selection effect, avoiding an immediate-read race. The required resulting Offer ID has not been relaxed.

The artifact contains 26 screenshots, a JSON receipt and 11 source copies with SHA-256 hashes. All 11 copied sources were rehashed after artifact download and matched the receipt. The receipt distinguishes PR HEAD from the GitHub merge checkout.

## Verified results

| Check | Result |
|---|---|
| 320 / 360 / 390 / 412 / 901 / 1024 / 1280 / 1440px, each with list/detail/work fixture state | **24/24 PASS** |
| Keyboard tabs and Offer selection at 390px and 1440px | **14/14 PASS** |
| Horizontal page/panel overflow and value clipping in those cases | **No failures** |
| ActionBar 44px minimum target height and 3:7 / 3:3:4 proportions | **PASS** |
| 320px picked summary single-column rule | **PASS** |
| Browser page errors during the tested cases | **None** |
| External browser requests | **0** |
| Downloaded source SHA-256 integrity | **11/11 PASS** |
| CI workflow on tested code HEAD | **PASS** |
| backend-check, including production build, on tested code HEAD | **PASS** |

Browser workflow: https://github.com/freepass-creator/freepass-admin/actions/runs/36117632523
CI workflow: https://github.com/freepass-creator/freepass-admin/actions/runs/36117632508
Backend workflow: https://github.com/freepass-creator/freepass-admin/actions/runs/36117632425

Artifact ID: `10855717069`.
Artifact name: `ui-browser-ee7177d6792624e0e527ffaa2afb4d4d9a3c7fb9`.
Artifact digest: `sha256:e08bb23c4894882e1264bb90f9fd83cbf1e4bd689366b347d1bacc27623c4bb1`.
Artifact retention: 7 days, expiring 2026-10-02. Re-run the workflow to regenerate evidence after expiry or source changes.

## Remaining gates

Not verified here: deployed pages after real login; real Firestore/IAM access; application routing; actual NewIntakeForm submissions; production settlement/e-sign workflows; FilterSheet modal interaction; real Android/iOS soft keyboards and safe areas; RTL; other browser engines; human visual/Design Hub approval.

CSS viewport reflow is not a claim of physical-device or actual browser-zoom testing. A passing build or component screenshot does not establish production readiness.

No merge, deployment, real contract, settlement, invoice or customer-data write was performed in this round.
