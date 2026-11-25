---
type: Decision
title: Why every PR adds a changeset
description: CI's required `🦋 Changeset` check fails a PR whose `changeset status --output` lists no changeset, since `changeset status` alone passes any PR that changes no package; a PR that ships nothing adds `pnpm changeset --empty`.
tags: [ci, releases]
sources:
  - id: changesets-empty
    resource: https://github.com/changesets/changesets/blob/main/docs/command-line-options.md
    title: Changesets, command line options
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T07:03:32Z }
verified: { by: human:jjloneman, at: 2026-11-25T15:34:21Z }
---

# Why every PR adds a changeset

- Releases come from changeset files, not commit messages.
- So a PR that forgets one changes a package without ever releasing the change.

## Decision

- **As of 2026-11-25,** from `.github/workflows/ci.yml` and `.github/rulesets/main.json`.
- **Every PR adds a changeset:**
  - `pnpm changeset` when it changes what a package ships, naming each package it bumps;
  - `pnpm changeset --empty` when it only touches tooling, tests, or docs, which records no release[^changesets-empty].
- **CI's `🦋 Changeset` job enforces it** with `changeset status --since=<base> --output=<file>`, failing when the file's `changesets` list is empty.
  - The list holds the changesets the PR added or edited, read by changesets' own rules, so a file changesets ignores (`.changeset/drafts/x.md`, `CLAUDE.md`) doesn't count, and an empty changeset does.
  - **Rejected: a `git diff` for any added `.changeset/*.md`.** It counted files changesets ignores, and missed an edited or renamed pending changeset (#12's review).
  - **Rejected: `pnpm changeset status --since=origin/main` alone,** as okf-tools has it. It fails only when a versionable package changed and no changeset exists, so in this monorepo it passes every PR that touches only root files, and every PR before the first package lands.
- **It skips the version PR (`changeset-release/main`) from this repo,** which only consumes changesets; a fork's branch of that name is still checked.
- **A Renovate PR (`renovate/*`) from this repo skips it only when it ships nothing**, as `.github/scripts/renovate-ships.sh` decides.
  - It ships a change when a package's `dependencies`, `optionalDependencies`, `peerDependencies` or `engines` change, a `catalog:` entry they point to included; then it needs a changeset that bumps a package, which the owner adds to its branch.
  - A dev dependency or root bump needs no changeset, since nothing published changes.
  - The script fails rather than answer "ships nothing" when it can't tell, so a broken check never skips a changeset.
  - **Rejected: skipping every Renovate PR,** as #12's plan first had it: a runtime dependency bump would merge without a release, so consumers would never get it (#12's review).
  - **Rejected: comparing only the manifests' dependency fields,** since a `catalog:` bump in `pnpm-workspace.yaml` changes a package's published dependency without touching its manifest (#12's review).
- **Every `ci.yml` job is a required check on `main`,** so the changeset job blocks a merge rather than just showing red.

## Why

- The question "does this release?" gets answered on every PR, rather than by remembering to.
- An empty changeset makes "nothing ships" an explicit answer, which the check can tell from a forgotten one.
- The owner chose to check for a changeset explicitly on 2026-11-25, in #12, once `changeset status` was found to pass a PR with no changeset here.

## Consequences

- Docs-only and CI-only PRs still add a changeset.
- #5 replaces the inline job with the kit's `require-changeset` action, which should keep checking the `changesets` list rather than relying on `changeset status`'s exit code.

## Links

- #12, which added the job.
- #5, which replaces it.

[^changesets-empty]: `changeset --empty` adds a changeset that bumps no package.
