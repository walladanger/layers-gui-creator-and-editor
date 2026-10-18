<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Working on this repo

- This is **Radium Panel Lab Studio**, built on the Ember Studio Foundation (React 19 + TypeScript + Vite + Tauri 2).
- The production plan is `docs/production-plan.md`. Work one phase at a time and keep its Global Constraints. Its §4 (bridge protocol) and §5 (data model) are fixed contracts.
- The official home of the project is `walladanger/radium-panel-lab`. Finished phases are synced there from this repo.
- `public/targets/radium-mock.html` is the original Radium Panel Lab (the demo target and test fixture). `legacy/` holds its README, HANDOFF and Playwright test for reference. Do not edit `legacy/`.
- Leave `src-tauri/` building. Keep `npm test` and `npm run build` passing on every commit.
- Product name lives in `src/app/brand.ts`; the title bar takes a replaceable `logo` (Ember flame by default) so the mark can change without touching the shell.
- Shell routes render through `renderRoute` in `src/features/pages/RoutePages.tsx`, so new pages plug in without editing the shell.
- Navigation hierarchy is declared with `parentId` in the registry; parent navigation and branch expansion are separate actions so parents retain their own pages.
- Editor windows are declared in `src/features/editor-windows/editorWindows.tsx` and spread into Ember's `windowRegistry`, keeping one window manager for everything.
- Canvas layout is stored under `extensionSettings['radium.canvasLayout']` (validated, versioned), so it persists through the existing settings service without changing `AppSettings`.
- Components reach data only through `src/services` (typed services + `ServicesProvider`); `src/services/supabaseRuntime.ts` is the single module that imports the Supabase client, so adapters can be swapped without touching UI.
- Each table has one generic `RecordAdapter` (Supabase and in-memory); the in-memory adapter mirrors the SQL row-level security rules so the shared `serviceSuite` proves both behave the same.
- Every service write goes through `QueuedWriter` (IndexedDB, ordered, client-made ids, backoff); writes the server rejects for good are kept aside, never dropped, so no edit is lost. Ordering is strict only across retryable failures: a permanently rejected write is set aside and later queued writes continue past it.
- File access (the `screenshots` bucket) goes through `StorageService` in `src/services/storageService.ts` (Supabase + in-memory adapters); paths follow §5 `{project_id}/{change_record_id}-{before|after}.png`.
- The demo project is seeded by a database trigger on account creation, so it appears exactly once per user regardless of client.
- Canvas frames load the target in iframes via `FrameHost`; same-origin targets (the demo) get `public/radium-bridge.js` injected at load, so target files are never edited.
- Project scanning (local folder, GitHub, demo) lives in `src/services/projectSource.ts`: adapters only fetch file text and pure `analyzeSources` finds screens, so new sources plug in without touching the analyzer.
- The Screens window hands a picked screen to the canvas through `src/features/screen-catalog/catalogBus.ts`, keeping the window and the canvas decoupled.
- Screen thumbnails use a bounded session cache in `src/services/screenSnapshots.ts`, keyed by source and screen; capture opened frames directly when same-origin or through the fixed screenshot bridge command otherwise, without changing production screenshot storage.
- CommandRibbon renders one expandable left menu through shell portal slots, keeping canvas-specific controls out of the shell.
- OriginalMenuService adapts same-origin Radium demo control descriptions and delegates actions to its existing runtime; OriginalMenuControls renders allowlisted controls without copying scripts or changing target files, preserving original behavior.
- Demo style history is scoped to each attached frame in OriginalMenuService; replay global values through original controls and delegate selected-item steps to native history so exports and persisted state stay consistent without editing target files.
- Original comment composers and reply dialogs render unscaled in the host; throttle target mutations so animation updates cannot starve dialogs, and delegate comment exports to the host clipboard because embedded frames may lack permission.
- Browser maximize uses the Fullscreen API with a separate-tab fallback when embedding blocks it; native desktop window actions remain behind NativeWindowService.

- Live-frame messages go through BridgeService with exact origin/source validation; LiveStyleService owns selection, preview history and queued change records so UI never performs bridge transport.
