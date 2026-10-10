# Phase 2 review: backend, auth and services vs docs/production-plan.md

Reviewed the implementation against the plan's Phase 2 bullets, the §5 data model, and the Global Constraints. Verdict: **Phase 2 is implemented as written, with three small gaps worth closing.**

## What checks out

- **Auth:** email/password and Google sign-in enabled on Lovable Cloud; `SignInPage` + `authService` with Supabase and in-memory versions; email confirmation required; demo project seeded by the `on_auth_user_created_seed_demo` trigger (and mirrored in `seedDemoProject` for the in-memory adapter).
- **Data model (§5):** all 13 tables exist with every listed column, `id`/`created_at`/`updated_at`, `updated_at` triggers, and RLS enabled. Policies match the contract: members read, owners/editors write, commenters can comment/reply/annotate, `agent_tokens` and `project_members` are owner-only.
- **Storage:** private `screenshots` bucket exists with member-read / editor-write policies scoped to `{project_id}/…` — matching the §5 path contract (`ChangeService.screenshotPath` generates the same paths).
- **Service adapters:** all 7 services (`ProjectService`, `SessionService`, `ChangeService`, `CommentService`, `ProductionService`, `TokenService`, `LookService`) with Supabase + in-memory adapters sharing one `RecordAdapter` shape; the in-memory adapter mirrors the SQL policies (verified line by line — including the owner-member trigger and project delete cascade). `supabaseRuntime.ts` is the only module importing the client.
- **Queue replay:** `QueuedWriter` is ordered, IndexedDB-persisted, backs off 500 ms → 30 s, retries on `online`, keeps permanently rejected writes aside instead of dropping them, and `pendingCount + failedCount` feeds the status bar's "unsynced" count. Review Focus 5 test passes, including exact replay order and idempotent insert replay.
- **Tests:** 115 passing; the shared `serviceSuite` runs against the in-memory adapters; the outage-replay, backoff, persistence-across-reload and permanent-failure tests all exist.

## Gaps found

1. **Live RLS suite is skipped by default.** `services.live.test.ts` needs `RADIUM_LIVE_ALICE_*` / `RADIUM_LIVE_BOB_*` accounts, so the plan's "RLS denies another user's rows" test only runs against the in-memory mirror in CI. The real database was checked once by hand (owner vs. other user), but that check is not repeatable.
   - *Fix:* create two confirmed test accounts, store the four env vars, and un-skip the live suite so it runs on demand (`npm test -- live`).
2. **No typed storage adapter yet.** The bucket and policies exist, but there is no `StorageService` in `src/services/` for uploading/fetching screenshots — Phase 6 (change-record screenshots) will need it, and the plan's "components never touch Supabase directly" rule means it must exist before then.
   - *Fix:* add a small `StorageService` (upload, signed URL, remove) with Supabase + in-memory adapters now, so Phase 6 builds on it.
3. **Minor queue-ordering note (not a violation).** When a write is permanently rejected, later queued writes continue past it. That is deliberate (a bad write must not block the queue) and matches "kept aside, never dropped", but it means strict ordering only holds for retryable failures. Worth one line in `AGENTS.md` so future phases don't assume otherwise.

## Proposed work

1. Add `StorageService` + adapters + tests (upload path, member-read/editor-write rules mirrored in memory).
2. Set up the two live test accounts and document how to run the live suite.
3. Add the ordering note to `AGENTS.md`.

No changes to the §4/§5 contracts are needed. `src-tauri/`, `legacy/` and `public/targets/` remain untouched.

## Technical details

- New files: `src/services/storageService.ts` (+ test), env vars `RADIUM_LIVE_ALICE_EMAIL/PASSWORD`, `RADIUM_LIVE_BOB_EMAIL/PASSWORD`.
- `StorageService` uses the existing `screenshots` bucket; paths via `ChangeService.screenshotPath`.
- Live suite stays opt-in so `npm test` stays hermetic.
