# Electronic Contract PDF Renderer

Status legend is intentionally strict: DESIGNED / CODED / STATIC CHECKED / TESTED / RUNTIME VERIFIED / STORAGE VERIFIED / DEPLOYMENT VERIFIED / USER APPROVED are separate states.

## Boundary

This component only implements the final electronic-contract document renderer. It does not own UI/UX, contract workflow redesign, intake provenance, settlement, FreePass Data, ERP4 fallback, or RTDB.

Production flow:

```text
immutable EsignSnapshot + private submission + verified signature bytes + sealHash
  -> buildContractHtml()
  -> inline Pretendard font assets + signature data URL
  -> server-side Chromium print rendering
  -> real A4 PDF bytes
  -> PDF magic/EOF validation
  -> SHA-256
  -> deterministic private Storage path
  -> Storage read-back with expected SHA-256
  -> atomic Contract + EsignSession + audit finalization
```

## Renderer choice

Production adapter uses `puppeteer-core` with `@sparticuz/chromium`. This preserves the existing HTML/CSS contract rather than redrawing the legal document. Chromium print mode honors the existing A4 print CSS, embeds the verified signature and Korean fonts without document-time network dependencies, and disables browser header/footer.

The versions are pinned to the same Chrome/Chromium major to avoid DevTools protocol drift.

## Font policy

The template requires Pretendard 400/500/600/700. `pretendard@1.3.9` is pinned as an OFL-1.1 dependency; `postinstall` copies exactly those four WOFF2 assets into `public/fonts`, while the upstream SIL Open Font License 1.1 text is retained in the repository.

At render time every font URL is replaced with a data URL. Missing or undersized generated font files fail closed; system-font fallback is not accepted as production evidence.

## Security and network policy

- contract HTML/PDF stays in memory; no PII-bearing temporary file is written;
- customer/signature data is not logged;
- final rendering blocks all non-`data:`/non-`about:` browser requests;
- visible broken images fail rendering;
- Firebase Storage remains private and the final document route requires administrator authentication;
- final PDF is stored with `private,no-store` cache metadata.

## A4 / print contract

The adapter uses A4, background graphics, CSS page sizing, no browser header/footer, zero browser margin, and waits for fonts. The builder/print harness is removed before Chromium receives the final HTML.

## Idempotency and recovery

The object path remains deterministic:

`esign-final/{contractCode}/{sessionId}.pdf`

A retry never creates another object name. After upload, the service downloads the object again with the expected SHA-256 before allowing the atomic signed finalization.

Chromium may emit binary metadata that is not guaranteed byte-for-byte deterministic between independent renders. PDF byte determinism is therefore not used as the idempotency key. Safety comes from the finalization claim, deterministic Storage path, SHA-verified read-back, and transactional finalization. If PDF upload succeeds but DB finalization fails, the next retry overwrites/verifies the same path; an orphan object is distinguishable because the session is not `signed`.

## Runtime controls

- `ESIGN_PDF_RENDER_TIMEOUT_MS`: render/page/PDF timeout, 1s..120s, default 45s.
- `ESIGN_PDF_LAUNCH_TIMEOUT_MS`: Chromium preparation/launch timeout, 1s..120s, default 30s.
- `ESIGN_CHROMIUM_EXECUTABLE_PATH`: explicit browser path for controlled local/runtime verification. Production normally uses the bundled Sparticuz executable.

## Verification

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The renderer integration test launches real Chromium, feeds the real contract template, waits for Korean fonts, and validates a real multi-page PDF. Passing local/CI tests is TESTED, not DEPLOYMENT VERIFIED. Deployment verification additionally requires a successful deployed Node runtime invocation and a real private Storage write/read-back receipt.
