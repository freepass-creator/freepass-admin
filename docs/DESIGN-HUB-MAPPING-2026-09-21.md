# FreePass Admin → Development Center Design Hub Mapping

Status: **MAPPED / NOT PILOT / NOT CONFORMANT**  
Mapping base revision: `92e2838b6da2df5f0b8733db494e879bd25d2e74`

## Authorities

- User-approved visual authority:
  - `docs/ui/mockups/admin-product-to-application.html`
  - SHA-256 `6d2c26dc171d0c519d8ba5d8f9d7ab4be29cfeb371f6c8e639606863b62cef7d`
  - approval recorded in `docs/WORK-INBOX.md#13`
- AI Core UI/UX:
  - `freepass-creator/ai-core@76b4c05f0b99a80033aa9d65030ac97df0f649e9`
  - Feature Registry `1.3.0`
- Development Center Design Hub:
  - `freepass-creator/devcenter@2d23a6b0dd57474fe9799d1253eefb6b78bad923`

## Current mapping

Machine manifest:
- `.ai-core/ui-ux.consumer.json`

Design Hub inputs:
- `.devcenter/design-authority.json`
- `.devcenter/design-job.json`
- `.devcenter/visual-job.json`

Validation:
```
npm run uiux:map
```

## Why this is only MAPPED

The current Next UI now implements the first approved rev 5 shell migration slice, but visual conformance has not yet been proven.

Confirmed deltas already documented in `docs/reviews/ADMIN-DESIGN-FUNCTION-AUDIT-2026-09-18.md`:

- current UI still has the admin quick-filter row; approved direction is search + detailed filter
- current mobile behavior stacks all three panels; approved direction is page/view navigation
- current visual structure differs materially from the approved floating-panel + rail shell
- browser conformance evidence does not exist for 360/390/412/1280/1440
- locale/input/zoom/reflow visual receipts do not exist

Therefore:
- `MAPPED` is valid
- `PILOT` is not yet supported
- `CONFORMANT` is not supported

## Next

1. preserve the approved visual SHA
2. wire current Next UI to Domain/Service as already prioritized
3. migrate the actual screen to the approved visual structure without inventing a new style
4. run Design Hub compile against the exact project revision
5. start local preview on `http://127.0.0.1:3000`
6. produce Browser Capture Manifest
7. review screenshots
8. produce Design Visual Receipt + Quality Receipt
9. only then evaluate PILOT promotion

Production deployment remains separately gated by `docs/RELEASE.md`.


## 2026-09-21 shell migration delta

Merged revision:
`92e2838b6da2df5f0b8733db494e879bd25d2e74`

Source-level changes now present:
- legacy heavy topbar removed
- left business rail added
- three floating desktop panels added
- admin quick-filter row removed
- search + detailed-filter entry retained
- Offer choices rendered as vertical whole-Offer rows
- mobile panel stacking replaced with explicit view navigation
- shell regression test added

This closes source-level gaps only. Browser/interaction evidence is still required before PILOT.
