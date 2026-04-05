<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

## ECC Codex Rules

These repository rules are adapted for Codex from the Everything Claude Code rule set and narrowed to this stack: React + Vite + TypeScript + Tailwind/shadcn + Supabase.

### Search First

- Read the existing implementation before editing. Reuse existing patterns and components before creating new ones.
- Prefer extending current modules over introducing parallel abstractions.
- For UI work, check nearby components first so visual and behavioral patterns stay consistent.

### Coding Style

- Prefer immutable updates. Do not mutate arrays, objects, props, query results, or shared state in place.
- Keep files focused and cohesive. Split large modules when a file mixes unrelated responsibilities.
- Avoid deep nesting. Extract helpers or small components when logic becomes hard to scan.
- Use constants or config for repeated values. Do not scatter hardcoded magic numbers or labels.

### TypeScript

- Prefer explicit types at boundaries and for exported APIs.
- Avoid introducing `any`. If unavoidable, isolate it and narrow immediately.
- Validate external data from Supabase, browser APIs, uploads, and third-party providers before trusting it.
- Keep client-visible product data clean: never expose supplier/internal metadata in B2B views unless explicitly intended.

### React / Frontend

- Reuse existing UI primitives first: `Button`, `Badge`, `SurfaceCard`, `EmptyState`, `PageHeader`, `DataTableShell`.
- Keep components small and composable. Move heavy data shaping into hooks or helpers.
- Prefer responsive layouts that collapse before overflowing. Avoid fixed widths that cause horizontal scroll unless the view is intentionally scrollable.
- For performance-sensitive views, defer or virtualize expensive sections instead of rendering everything eagerly.
- Do not hardcode theme colors inside feature components. Use tokens and existing variants.

### Error Handling

- Handle errors explicitly at system boundaries.
- Show actionable user-facing errors in UI code.
- Log detailed context in dev/admin flows when troubleshooting, but avoid leaking internal/provider details to B2B users.
- Never swallow failed async operations silently.

### Testing And Verification

- Verify work before considering it done.
- Default verification loop for this repo:
  - `npm run lint -- --quiet`
  - `npm run typecheck`
  - `npm run build`
- For regressions in critical user flows, prefer fixing implementation over weakening tests or checks.

### Supabase / Data Safety

- Treat auth, role, pricing, credit, and assignment logic as sensitive. Preserve backward compatibility unless a migration is deliberate.
- Prefer additive migrations and compatibility fallbacks over breaking schema assumptions.
- Never expose service-role secrets, provider credentials, or internal sync metadata in client-facing code.

### Git / Change Scope

- Keep changes scoped to the task at hand.
- Do not rewrite unrelated areas while fixing a local issue.
- If a new rule conflicts with established repo behavior, adapt the rule to the repo instead of forcing a generic pattern.

### Completion Criteria

- A task is only complete when:
  - the requested behavior works,
  - the affected UI is visually coherent,
  - no internal/provider metadata leaks into customer-facing surfaces,
  - lint, typecheck, and build pass unless the user explicitly accepts an exception.
