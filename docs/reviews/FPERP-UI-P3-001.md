# FPERP-UI-P3-001 — DevCenter-aligned UI Review Packet

Status: **HOLD — user UI approval and named 4-AI review pending**

## Purpose

Replace the visually inconsistent P2 mobile drafts with one FreePassERP.com mobile-web profile based on DevCenter evidence and public web-accessibility baselines.

No application code, Firebase configuration, runtime behavior, merge, or deployment is authorized.

## Project base

- FreePassERP.com base commit: `7dc793f4fc6f1d5b53a119f1bc4c1e410794ae4c`
- Project rules blob: `35be38870e75eb3ceb7516b22bcff95d5dcc11f0`
- Product master blob: `290b040350b0dec56fc24cc09a78b5dd7d49a366`
- UI profile: `docs/ui/FPERP-ADMIN-UI-PROFILE-v0.1.md`

## Current images

| Pair | Path | SHA-256 |
|---|---|---|
| 상품 목록 → 상품 상세 | `docs/ui/review-p3/mobile-product-list-detail.webp` | `2299b2d71096a9f2c75230f99d480dc5e371633e4eb5da564d9abb8bcf8908b1` |
| 접수 목록 → 접수 상세 | `docs/ui/review-p3/mobile-application-list-detail.webp` | `43c18e41932d48e05f1bf594e9d343ba7ef03dcc274054879b2028c5212af537` |
| 실적 목록 → 실적 상세 | `docs/ui/review-p3/mobile-performance-list-detail.webp` | `e7c96bce209fd237466597911d22f4a9d7bda90fee78fa16f6d0d95c0063150e` |
| 청구·지급 목록 → 건별 상세 | `docs/ui/review-p3/mobile-billing-payment-list-detail.webp` | `3b78c513e3f31d1b1a9ae7d8fbf8795562d660a29b0d91c8116a141a816ffa45` |

P2 images are superseded and must not be used as current review evidence.

## Fixed product decisions

- Mobile is not a compressed desktop layout.
- Desktop remains equal 1:1:1: product list, product detail, work panel.
- Mobile uses independent full screens and list/detail pairs.
- Initial application intake has exactly four required values: vehicle, sales channel, assignee, customer name.
- Product-detail entry prefills vehicle; direct new-application entry requires selection.
- Lists use two-line rows; the whole row opens detail with one tap.
- Back restores query, filters, sort, scroll, selected item, focus, and finance tab.
- Performance is read-oriented and does not duplicate application entry.
- Billing and payment share one menu but are separated by `청구 | 지급`.

## Profile decisions

- One white 64px application header across every mobile screen.
- 14px outer/card padding, 8px gaps, 8px card radius, 4px small-label radius.
- Mobile controls are at least 44px; search/input is 48px.
- FreePass mobile type is enlarged from the dense WORK-ERP candidate: 20px page, 17px section, 16px list primary, 14–15px body, 13px metadata, 12px status.
- Neutral-first palette; green completed, amber waiting, red actual problem.
- Button/action, chip/selection, and row/detail-open have distinct appearances.

## Static-image limitations

These images validate hierarchy and component language only. They cannot prove exact CSS dimensions, contrast, focus order, state restoration, responsive reflow, safe-area behavior, loading/error states, or idempotent save. Those require a code-native prototype and measured browser evidence after image approval.

## Named review gate

Claude Code, Codex, Cursor Agent, and Gemini CLI must independently inspect the same final commit, profile blob, and all four image hashes. Internal advisory agents cannot be substituted for named external products.

Required response:

`reviewer_product / reviewer_version / reviewed_commit / reviewed_profile_sha / reviewed_image_hashes / findings / counterexample / verdict`

AI Core status remains `HOLD / EVIDENCE_MISSING / execution_authorized:false`.