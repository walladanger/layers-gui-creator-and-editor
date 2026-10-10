# Lovable prompts

## Prompt 1: create the project (paste on the Lovable home page)

> Create a project called **Radium Panel Lab Studio**. For now build only a placeholder page that says "Radium Panel Lab Studio: importing foundation". Do not add features yet. The real foundation code (React 19 + Vite + TypeScript + Tailwind, from my Ember Studio Foundation repo) will be pushed to this project's GitHub repo next, along with `docs/production-plan.md`, which you will then implement phase by phase.

## Prompt 2: after the Ember code and plan are pushed to the connected repo

> This repo now holds my Ember Studio Foundation shell, plus `docs/production-plan.md`. Read `docs/production-plan.md` in full: it is the production plan for this app. Keep every rule in its **Global Constraints** section. Treat §4 (the bridge protocol) and §5 (the data model) as fixed contracts.
>
> Start with **Phase 0's last step**: make the existing code run in your preview without changing its architecture. Use the Vite dev server on port 8080 with host `::`, and add your component tagger in dev mode only if you need it. Leave `src-tauri/` untouched. Make sure `npm test` and `npm run build` still pass.
>
> Then implement **Phase 1** exactly as written. Stop when Phase 1's tests and acceptance checks pass, and list what you did against each bullet.

## Prompts 3 and later: one per phase

> Implement **Phase N** of `docs/production-plan.md` exactly as written, keeping the Global Constraints and the §4/§5 contracts. Add the tests the phase lists. Stop when they pass and `npm run build` succeeds. Then report each bullet as done or not done, and anything you changed in the plan's contracts (there should be nothing).
