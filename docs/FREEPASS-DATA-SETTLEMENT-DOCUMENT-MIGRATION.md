# Settlement Document Write Migration

FreePass Admin is a public UI repository. It must not own F04 Sheet writes, Drive PDF overwrite, or Firestore `settlement_rules` / `pdf_*` run writes.

- `scripts/f04-basis-from-notes.mjs` remains dry-run/self-test only. Actual F04 publication belongs in `freepass-data`.
- Monthly receipt PDF generation is marked as a `freepass-data` migration target and is disabled in Admin by default.
- Temporary escape hatch for controlled migration tests only: `ADMIN_RECEIPT_DOCUMENTS_ENABLED=on` plus private document config and owner email env. Do not enable from the Admin screen as an operating path.
- Target owner: FreePass Data should expose a server-side command that owns source freshness, document reservations, Drive writes, run state, and readback.
