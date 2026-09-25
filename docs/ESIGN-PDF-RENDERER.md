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

## Template assets (supplier logos)

The template references supplier logos relative to its public URL (`assets/…`), from both markup and its own script. The final render runs on `about:blank` with the network blocked, so every referenced `assets/*.png|webp|jpg` that ships under `public/contract-template/assets/` is inlined as a data URL. A referenced asset that does not ship resolves to `''`, which makes the template take its documented no-logo path (logo hidden, company name shown) deterministically instead of racing its `onerror` handler.

DECISION REQUIRED: `assets/logo-sonogong.webp` and `assets/logo-jpk.png` are referenced by the template but are not in the repository. Until those brand files are supplied, final PDFs for those suppliers show the company name instead of the logo.

## Overflow / truncation guard

Every page is a fixed A4 box, and its inner regions (`.pbody`, cards, special terms) use `overflow:hidden`. Text that does not fit is hidden inside those regions, never on the page box itself, so a page-level check alone passes while legal text is silently dropped. Before this guard, measured on the real template:

- special terms of ~4,500+ chars: only the first ~67 clauses reached the PDF;
- options of 300 chars: pushed the "초과주행 정산" clause (약관 제23조 안내) off page 2 — it vanished from the PDF.

The renderer now checks every visible clipping container inside each page and fails closed (`영역을 넘쳐 잘리는 내용`), reporting only class names (no contract text).

Measured limits with the current template (pass / blocked):

| Field | Passes | Blocked |
|---|---|---|
| options | 150 chars | 200 chars |
| special terms (prose) | 3,000 chars | 3,300 chars |
| special terms (short lines) | 20 lines | 40 lines |
| customer address | 200 chars | 300 chars |
| vehicle remark | 120 chars | — |

DECISION REQUIRED (outside this renderer): either cap these inputs at intake/issue time, or let the template flow long special terms onto continuation pages. Until then, an over-long contract cannot be finalized (it is never sealed with missing text).

## Runtime footprint (measured locally, Chromium 147)

- traced files for the approve route: ~89 MB (Chromium brotli 64 MB) — under Vercel's 250 MB function limit;
- cold render incl. Chromium extraction ~4.1 s, warm ~1.9 s; end-to-end approval on emulators ~4–5 s;
- peak RSS (node + Chromium, upper bound) ~0.7–0.8 GB;
- no Chromium process or temp HTML/PDF left after a render.

## Browser-side code

Code evaluated inside Chromium (`waitForFunction`/`evaluate`) is passed as source strings, never as TypeScript functions. Transpilers (tsx/esbuild `keepNames`, Next/SWC) may inject helpers such as `__name` into serialized functions; those do not exist in the page and previously made every render fail (`ReferenceError: __name is not defined`).

## Font policy

The template requires Pretendard 400/500/600/700. `pretendard@1.3.9` is pinned as an OFL-1.1 dependency; `postinstall` copies exactly those four WOFF2 assets into `public/fonts`, while the upstream SIL Open Font License 1.1 text is retained in the repository.

At render time every font URL is replaced with a data URL. Missing or undersized generated font files fail closed; system-font fallback is not accepted as production evidence.

## Script isolation (CSP) and template escaping

Measured by injecting HTML/script payloads into every template field and every customer submission field:

- all customer-submitted fields (name, address, phone, birth, licence, emergency contact, signer, consents) are written with `textContent` — no execution;
- `company_seal` (via `sealHtml`) executed an injected `onerror` handler;
- `company_name` containing `</div>` broke the terms page structure and the pagination loop never ended (render hung until the timeout). `company_name`/`terms_title` were concatenated into `innerHTML`.

Fixes:

1. The template escapes `company_name`, `terms_title`, `company_seal` and the auto-seal name before building HTML strings (no design change; normal renders are pixel- and text-identical).
2. Independently, the renderer adds a Content-Security-Policy to the final HTML: only the inline scripts already present (template scripts + server-injected sealed JSON, whose `<` is escaped) may run, pinned by SHA-256; no `unsafe-inline` for scripts, so injected `<script>`/`on*=` never execute; `connect-src`/`frame-src`/`worker-src`/`form-action` are `'none'`, so fetch/XHR/WebSocket are refused even though the bundled Chromium runs with `--disable-web-security` (request interception alone does not cover WebSocket). Scripts with attributes (`<script src>`) are rejected.

Tests prove each layer separately (reverting the template makes the pagination test time out; removing the CSP makes the CSP test fail).

## Diagnostics

A render failure returns and logs only the stage (`prepare-browser | launch | load-document | template-script | readiness | print-pdf`), the error class and elapsed ms — e.g. `[esign-pdf] render failed { stage: 'readiness', kind: 'Error', ms: 1188 }`. Chromium's own message is kept only as `cause` and is never logged, because it can echo contract content. Readiness failures name only CSS class names or template asset paths.

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

### Byte determinism

Measured on Chromium 147 (Skia/PDF m147): for the same HTML, the only bytes that differ between renders are the Info dictionary `/CreationDate` and `/ModDate` (render wall clock). The renderer replaces both, same-length, with the customer's `submittedAt` (immutable input), and fails closed if they are not present exactly once each. It also pins timezone (`Asia/Seoul`) and `--lang=ko-KR` so in-page formatting cannot drift between runtimes. The template's own script has no clock/random input.

Result: for a given renderer + template version, the same sealed input produces identical PDF bytes/SHA-256 — verified across repeated renders, separate processes, and tsx vs. the Next production bundle. This matters for the deterministic path: if a stale claim's upload lands after a newer claim finalized, it writes the same bytes, so the signed `documentSha256` still matches the stored object.

Determinism is still not used as an idempotency key. Safety comes from the finalization claim, deterministic Storage path, SHA-verified read-back, and transactional finalization. If PDF upload succeeds but DB finalization fails, the next retry re-renders the same bytes to the same path and verifies them; an orphan object is distinguishable because the session is not `signed` and the contract carries no `esign_document_sha256`. After `signed`, a retry with the same `finalizationId` is a no-op (no re-render, Storage object generation unchanged); a different id is refused.

Determinism is per renderer/template version: a template or renderer change can reorder PDF objects (same pixels and text, different bytes). A retry that straddles a deploy therefore writes different bytes to the same path — still safe, because the service hashes what it wrote, verifies the read-back, and records that hash at finalization.

A Chromium upgrade must re-run the renderer tests: they assert byte-identical re-renders and the pinned Info dates.

## Runtime controls

- `ESIGN_PDF_RENDER_TIMEOUT_MS`: per render/page/PDF operation cap, 1s..120s, default 45s.
- `ESIGN_PDF_LAUNCH_TIMEOUT_MS`: Chromium preparation/launch operation cap, 1s..120s, default 30s.
- `ESIGN_PDF_TOTAL_TIMEOUT_MS`: whole renderer budget, default 65s and hard-capped at 80s so the 90s approval route retains time for Storage verification and DB finalization.
- `ESIGN_CHROMIUM_EXECUTABLE_PATH`: explicit browser path for controlled local/runtime verification. Production normally uses the bundled Sparticuz executable.

## Verification

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Emulator end-to-end (real EsignService + ERP5 Firestore/Storage adapters + Chromium; refuses to run without emulator hosts):

```bash
firebase emulators:start --only firestore,storage --project freepasserp5   # separate shell
FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
STORAGE_EMULATOR_HOST=http://127.0.0.1:9199 ERP5_SERVICE_ACCOUNT_PATH=<throwaway freepasserp5 key> \
ERP5_WRITE=on PUBLIC_BASE_URL=https://admin.example.test \
npx tsx scripts/verify-esign-pdf-emulator.mts
```

It checks: concurrent approvals -> exactly one signed; Firestore session/contract/audit evidence; independent Storage download SHA-256, `application/pdf`, `private,no-store`; exactly one object under the contract prefix; `finalDocument()` bytes; same-id retry no-op with unchanged object generation; different-id refusal; re-render reproduces the stored SHA-256.

The renderer integration test launches real Chromium, feeds the real contract template, waits for Korean fonts, and validates a real multi-page PDF. Passing local/CI tests is TESTED, not DEPLOYMENT VERIFIED. Deployment verification additionally requires a successful deployed Node runtime invocation and a real private Storage write/read-back receipt.

## Verification status — 2026-09-25 (updated after local/emulator verification)

| State | Status | Evidence / blocker |
|---|---|---|
| DESIGNED | PASS | Existing HTML/CSS is preserved; production boundary is `EsignFinalDocumentRenderer`. |
| CODED | PASS | Production Chromium adapter is wired into `EsignService`; no UI/workflow redesign is included. |
| STATIC CHECKED | PASS (local) | `typecheck`, `ui:check`, `data:check`, `next build` pass locally. GitHub Actions still assigns no runner (`runner_id=0`, `steps=[]`), so there is no CI receipt. |
| TESTED | PASS (local) | `npm test` 423/423 on Node 22; renderer/PDF/service suites pass on Node 24.21 — real Chromium PDF, A4, fonts, determinism, overflow, CSP, fail-closed paths. |
| RUNTIME VERIFIED | PARTIAL | Local `next start` production bundle rendered via the adapter (~1.7–2.0 s warm, ~4.1 s cold). No Vercel invocation. |
| STORAGE VERIFIED | PARTIAL | Firebase emulators with the real ERP5 adapters (`scripts/verify-esign-pdf-emulator.mts`): private write, independent SHA read-back, atomic signing, retries. No real Firebase Storage receipt. |
| DEPLOYMENT VERIFIED | NOT VERIFIED | The connected Vercel team exposes no project for this repository, so no deployed invocation is possible yet. |
| USER APPROVED | NOT VERIFIED | Awaiting user acceptance after deployment evidence. |

Do not promote this PR out of Draft solely because the renderer compiles on inspection or because a local/synthetic PDF can be produced.

## Additional fail-closed checks

The renderer and service now reject the finalization path when any of the following is true:

- final bytes do not contain a PDF header, minimum body, and tail `%%EOF`;
- a rendered page is not A4-sized within a small CSS-pixel tolerance;
- a page reports content overflow/clipping;
- Pretendard is not loaded;
- a visible image is broken;
- no visible customer signature was rendered;
- the visible seal-hash evidence is missing;
- an interactive print control remains in the document;
- Storage returns a SHA-256 different from the rendered bytes;
- Storage read-back cannot verify the expected hash/content type.

Chromium executable extraction is cached per warm Node process. Browser launch relies on Puppeteer's native timeout so a second wrapper timeout cannot abandon a late-launching Chromium process. Browser shutdown has a bounded graceful close and a best-effort process kill fallback.

## Runtime baseline

- Node runtime is pinned to `24.x` for CI/deployment consistency.
- Current renderer pair remains `puppeteer-core@24.41.0` + `@sparticuz/chromium@147.0.2`.
- These share the same browser major. A newer matching pair is not adopted in this Draft until the current branch can actually execute `npm ci / typecheck / test / build`; changing the browser dependency tree without executable validation would increase risk rather than reduce it.
