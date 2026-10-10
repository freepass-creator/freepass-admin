# Settlement Document Write Migration

FreePass Admin is a public UI repository. It must not own F04 Sheet writes, Drive PDF overwrite, or Firestore `settlement_rules` / `pdf_*` run writes.

- `scripts/f04-basis-from-notes.mjs` remains dry-run/self-test only. Actual F04 publication belongs in `freepass-data`.
- Monthly receipt PDF generation has been removed from Admin: form, server action, gateway command, PDF/Drive adapter, templates, CLI, and PDF-only repository methods/types/tests.
- No Admin enable flag or temporary PDF write path remains. `listWithPublishedReceipts` stays in `src/adapters/erp5/settlement-repository.ts` for the SettlementScreen, ledger, and settlement page published monthly totals.
- Target owner: FreePass Data should expose a server-side command that owns source freshness, document reservations, Drive writes, run state, and readback.
