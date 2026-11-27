---
type: Decision
title: Why the kit supports Node 26 only
description:
  Every package declares `engines.node >=26`, and CI runs Node 26 alone with no
  version matrix; a consumer whose own published code supports older Node keeps
  that support, but runs its tooling, the kit included, on Node 26.
tags:
  - ci
  - consumers
  - devengines
  - engines
  - node
  - setup-action
sources:
  - id: setup-node-version-file
    resource: https://github.com/actions/setup-node/blob/v7.1.0/docs/advanced-usage.md
    title: actions/setup-node, advanced usage
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T23:17:48Z }
verified: { by: human:jjloneman, at: 2026-11-27T23:26:20Z }
---

# Why the kit supports Node 26 only

- The kit is dev tooling: it runs on the developer's machine and in CI, never in
  a consumer's production code.

## Decision

- **As of 2026-11-26,** from `package.json`, `actions/setup/action.yml` and
  `.github/workflows/ci.yml`.
- **Node 26 is the only supported Node** (26.13.1 LTS as of 2026-11-24, per #1).
  - The root has `engines.node: ">=26"`, and `devEngines.runtime` refuses any
    older Node with `onFail: error`.
  - Every kit package declares `engines.node: ">=26"` (#4, #7–#11).
- **CI runs Node 26 alone**, with no version matrix; the kit's `setup` action
  installs `node-version: "26"` unless told otherwise.
- **Node 26 is set in three places, with no single source:** `engines.node`,
  `devEngines.runtime` and the `setup` action's `node-version` default.
  - `engines` and `devEngines` are floors (`>=26`), while the action picks the
    one Node CI runs, so they answer different questions.
  - **Rejected: reading the version from `package.json`** through
    `actions/setup-node`'s `node-version-file`, which takes `devEngines.runtime`
    or `engines.node`, both the range `>=26`, and installs the newest match in
    the runner's cache, else downloads one[^setup-node-version-file].
    - CI's Node would then follow GitHub's runner images, moving to Node 27 once
      they cache it, with no kit change (#6).
- **A consumer whose published code supports older Node keeps that support**,
  but runs its tooling on Node 26.
  - Only a job that tests its own published code on an older Node passes that
    version to the kit's `setup` action, which takes a `node-version` input
    defaulting to `"26"`.
  - That job runs just the install and its tests; lint, typecheck, hooks and
    releases stay on Node 26.
  - A consumer that refuses older Node at install, as jj-kit's own `devEngines`
    does, can't run such a job, so it leaves that guard out.
  - It keeps `@types/node` at its own floor, which `kit-tsconfig` doesn't pin,
    and lowers that package's `es2025` `target` and `lib` to match (#8).

## Why

- Dev tooling runs where the owner chooses the Node version, so supporting older
  ones buys nothing and costs a CI matrix.
- jj-kit's own `prettier.config.ts` relies on Node running TypeScript under type
  stripping today, since Prettier loads it with a plain `import()`, and the
  kit's actions' TypeScript scripts do too (#5).
  - Any Node with type stripping on by default would do; 26 is simply the one
    the kit supports, not the only one that strips types.
- One version keeps every check, from `@types/node` to the typecheck, aimed at
  the APIs that Node actually has.

## Consequences

- A consumer's own tooling needs Node 26 too: CI, git hooks, and the developer's
  machine.
- Moving to the next Node LTS is a breaking change for every package, and
  updates all three places together.

## Links

- #1, the roadmap's toolchain notes.
- #2, the scaffold.
- #3, which records this decision.
- #6, the `setup` action, which settled where the version is set.

[^setup-node-version-file]:
    As of `actions/setup-node` v7.1.0, `node-version-file: package.json` reads
    `volta.node`, then `devEngines.runtime`, then `engines.node`, and without
    `check-latest` a range is matched against the runner's cached Node versions
    before any download.
