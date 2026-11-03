# PARKED / DO NOT MERGE — shadcn/ui component expansion

**Branch:** `codex/shadcn-asset-preview-layout`
**Pull request:** [#17](https://github.com/walladanger/layers-gui-creator-and-editor/pull/17)
**State:** Closed, not merged. Branch is retained intentionally.
**Label:** `do-not-merge` on PR #17.

## Purpose

Experimental work on the Layers Assets component library. This branch explores:

- A compact, documentation-style live preview layout and example code.
- A complete interactive Accordion FAQ demo.
- A locally vendored Attachment component.
- An expanded shadcn/ui component discovery catalog, including documentation-only entries.
- Tests for the new Assets browser.

## Why it is parked

The user requested that work on adding components stop. This implementation is incomplete and **must not be merged into `main` without a new explicit request**. In particular, the wider catalog does not bundle all components as working, insertable React components.

## Active approach

The separate branch `codex/disable-component-library` disables the existing Components UI and shadcn insertion, while preserving the Lucide Icons library and all unrelated Layers editor functionality.

## Retention policy

Keep this source branch for potential future reference. Do not delete, merge, automatically rebase, or resume the component expansion. Any reactivation must be authorized by the user.
