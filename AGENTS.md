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
- Editor windows are declared in `src/features/editor-windows/editorWindows.tsx` and spread into Ember's `windowRegistry`, keeping one window manager for everything.
- Canvas layout is stored under `extensionSettings['radium.canvasLayout']` (validated, versioned), so it persists through the existing settings service without changing `AppSettings`.
