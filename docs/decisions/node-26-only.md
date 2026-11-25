---
type: Decision
title: Why the kit supports Node 26 only
description: Every package declares `engines.node >=26`, and CI runs Node 26 alone with no version matrix; a consumer whose own published code supports older Node keeps that support, but runs its tooling, the kit included, on Node 26.
tags:
  - ci
  - consumers
  - devengines
  - engines
  - node
  - setup-action
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T18:09:43Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# Why the kit supports Node 26 only

- The kit is dev tooling: it runs on the developer's machine and in CI, never in a consumer's production code.

## Decision

- **As of 2026-11-25,** from `package.json`, `.github/actions/setup/action.yml` and `.github/workflows/ci.yml`.
- **Node 26 is the only supported Node** (26.13.1 LTS as of 2026-11-24, per #1).
  - The root has `engines.node: ">=26"`, and `devEngines.runtime` refuses any older Node with `onFail: error`.
  - Every kit package declares `engines.node: ">=26"` (#4, #7–#11).
- **CI runs Node 26 alone**, with no version matrix; the setup action installs `node-version: "26"`.
- **A consumer whose published code supports older Node keeps that support**, but runs its tooling on Node 26.
  - Only a job that tests its own published code on an older Node passes that version to the kit's `setup` action, which takes a `node-version` input defaulting to `"26"` (#6).
  - That job runs just the install and its tests; lint, typecheck, hooks and releases stay on Node 26.
  - A consumer that refuses older Node at install, as jj-kit's own `devEngines` does, can't run such a job, so it leaves that guard out.
  - It keeps `@types/node` at its own floor; `kit-tsconfig` doesn't pin one (#8).

## Why

- Dev tooling runs where the owner chooses the Node version, so supporting older ones buys nothing and costs a CI matrix.
- jj-kit's own `prettier.config.ts` relies on Node running TypeScript under type stripping today, since Prettier loads it with a plain `import()`, and the planned actions' TypeScript scripts will too (#5).
  - Any Node with type stripping on by default would do; 26 is simply the one the kit supports, not the only one that strips types.
- One version keeps every check, from `@types/node` to the typecheck, aimed at the APIs that Node actually has.

## Consequences

- A consumer's own tooling needs Node 26 too: CI, git hooks, and the developer's machine.
- Node 26 is set in three places today: `engines`, `devEngines`, and the setup action; #6 decides whether one of them becomes the source for the others.
- Moving to the next Node LTS is a breaking change for every package.

## Links

- #1, the roadmap's toolchain notes.
- #2, the scaffold.
- #3, which records this decision.
- #6, the `setup` action.
