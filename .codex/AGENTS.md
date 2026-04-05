## Codex Repo Supplement

This file tightens the root repository instructions for Codex sessions working inside `E:\Github\bartez-tech-nexus`.

### Operating Mode

- Prefer direct implementation over long planning unless the task is ambiguous or high-risk.
- Make reasonable assumptions from the codebase and move forward.
- Keep replies concise and operational.

### Mandatory Verification

- After non-trivial code changes, run:
  - `npm run lint -- --quiet`
  - `npm run typecheck`
- Run `npm run build` for UI, routing, modal, bundling, or cross-module changes.
- Do not claim a fix is done without verifying it.

### Frontend Constraints

- Use existing primitives and tokens before creating new UI patterns.
- Avoid horizontal overflow, overlapping panels, and fixed-width layouts that break intermediate desktop sizes.
- For modals, heavy tables, timelines, and specs:
  - defer expensive sections,
  - virtualize large lists,
  - keep scroll localized,
  - avoid blocking the whole page with unstable layout shifts.

### B2B Portal Rules

- Customer-facing B2B screens must not expose supplier or sync internals.
- Hide provider metadata such as:
  - supplier names used for sync,
  - provider IDs,
  - `air_*`, `elit_*`, `invid_*`, `supplier_*`, `provider_*`, `sync_*`, `internal_*`,
  - stock internals like `lug_stock`, depot breakdowns, or source exchange metadata.
- If external specs are messy, transform them into clean customer-facing values instead of dumping raw JSON/HTML.

### Admin Dashboard Rules

- Preserve operational density. Prefer compact enterprise layouts over oversized marketing-style cards.
- New admin surfaces should support realistic desktop widths without forcing horizontal scrolling.
- Seller/client/account views should behave as CRM/ERP workspaces, not read-only profile pages.

### Supabase And Backward Compatibility

- This repo has legacy compatibility paths. Prefer compatibility layers over abrupt renames.
- When normalizing roles, assignments, or profile fields, keep fallback handling unless the migration is fully in place.
- If schema drift is possible, code defensively and add graceful fallbacks.

### Debugging Standard

- When a UI breaks, inspect the real data path before changing presentation code.
- Distinguish between:
  - query returning no rows,
  - bad filtering/pagination,
  - broken image/storage URL,
  - provider metadata leaking into UI,
  - layout/render performance issues.

### Change Discipline

- Keep patches local to the problem.
- Do not refactor unrelated modules while fixing a user-facing bug.
- If a user reports a regression, prioritize restoring working behavior first, then refine.
