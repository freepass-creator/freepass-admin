# Function Lane Backlog

`work/function` is the single functional development lane for FreePass Admin.

## Imported hold — intake contract condition atoms

Source (historical only): `feat/intake-contract-condition-choices-20260923`
Source HEAD: `823f105a1c6b37a5d8e01bdf0d106d4f3ec9fa08`

This historical branch is not canonical and must not be merged wholesale. Preserve the following functional intent for selective implementation on the current function lane:

- Contract payment choices: 일시납 / 2회분납 / 3회분납.
- Offer/policy-derived annual mileage.
- Driver age choices based only on confirmed base/lowered-age policy values; do not invent intermediate ages.
- Age-lowering cost and additional-driver cost as explicit policy-derived facts.
- Deposit installment state: ALLOWED / BLOCKED / UNKNOWN.
- When deposit is zero or installment is explicitly disallowed, only 일시납 is allowed.
- Intake-side candidate fields previously explored: annualMileageKm, age, upsell, region.
- Keep these contract-condition atoms separate from fee-basis fields such as rent/price.

Before implementation, reconcile these atoms with current `main`/`work/function`, current FreePass Data schema, and current intake snapshot contract. Add regression tests in the same change. Do not resurrect the historical branch.


## Cross-lane e-sign cancellation coordination

Historical integration PR #103 contained useful cancellation/e-sign race handling that is not fully represented after the function/e-sign lanes were separated.

Preserve the requirement, not the old implementation:

- Contract cancellation must not race through a fresh e-sign submitting/approving claim.
- A stale claim must be recoverable under an explicit TTL rule.
- An idempotent cancellation retry must not leave an active signing session attached to an already-cancelled contract.
- E-sign writes after contract cancellation/termination must fail closed instead of reviving sign state.
- Cancellation reason/operation id drift remains rejected by the current contract cancellation domain.

Ownership: contract facts remain in `work/function`; e-sign session state remains in `work/esign`. Define the integration contract through `main` rather than creating a bridge branch.
