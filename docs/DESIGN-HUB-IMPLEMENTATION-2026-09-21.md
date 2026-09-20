# FreePass Admin approved shell implementation — 2026-09-21

Status: **CODED / STATIC EVIDENCE PENDING / NOT PILOT / NOT CONFORMANT**

## Scope

This slice migrates the actual Next.js Admin shell toward the user-approved rev 5 visual authority without changing the product/domain architecture.

Approved authority:
- `docs/ui/mockups/admin-product-to-application.html`
- SHA-256 `6d2c26dc171d0c519d8ba5d8f9d7ab4be29cfeb371f6c8e639606863b62cef7d`

## Implemented

- removed the legacy heavy topbar
- added left-side business rail
- converted the desktop workspace to three floating panels
- removed the admin quick-filter strip
- kept only search + detailed-filter entry
- changed Offer selection to vertical whole-Offer rows
- moved primary detail actions to a bottom action boundary
- changed application list rows to single-click task rows
- added explicit mobile view navigation
- stopped rendering all three desktop panels as a long mobile stack
- retained the existing mock business state/functions for this visual slice

Regression test:
- `src/ui-shell.test.ts`

## Deliberately not changed in this slice

- current hard-coded prototype data
- Domain/Service wiring
- natural-language search parser
- required application fields
- balance step
- cancellation reason dialog
- persistence/auth
- settlement domain
- production deployment

Those remain separate functional work and must not be hidden by a visual migration.

## Conformance status

This is not enough for PILOT.

Still required:
1. exact revision passes typecheck/test/build
2. Design Hub compiles the exact merged revision
3. local runtime preview is captured at required viewports
4. screenshot cases are visually reviewed
5. Design Visual Receipt is created
6. Quality Receipt is created
7. remaining approved-vs-implementation deltas are closed or registered

Production deployment remains governed by `docs/RELEASE.md`.
