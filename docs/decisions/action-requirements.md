---
type: Decision
title: What the actions require of a consumer
description:
  The kit's actions run on a Linux or macOS runner after the consumer's own
  setup step, with Node 26, pnpm, `@changesets/cli` 3 or later and, for a
  Renovate PR, `yq` v4; they fail clearly when Node or the Changesets CLI is too
  old, rather than bringing their own.
tags:
  - actions
  - changesets
  - consumers
  - node
  - runners
  - setup-action
  - shell
  - yaml
sources:
  - id: node-matches-glob
    resource: https://nodejs.org/api/path.html#pathmatchesglobpath-pattern
    title: Node.js, path.matchesGlob
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-26T21:37:48Z }
verified: { by: human:jjloneman, at: 2026-11-26T19:29:41Z }
---

# What the actions require of a consumer

- `pack-release` and `require-changeset` run TypeScript and shell out to pnpm,
  git and Changesets, and `version-or-release` runs Changesets' own sub-actions,
  so they depend on what the runner and the consumer's checkout already have.
- A missing or wrong tool otherwise shows up as a confusing failure, or worse, a
  check that passes when it shouldn't.

## Decision

- **As of 2026-11-26,** from `actions/*/action.yml`, `actions/lib/`,
  `actions/pack-release/src/` and `actions/require-changeset/src/main.ts`.
- **Each action runs after the consumer's own setup step**: a checkout, Node 26
  on `PATH`, pnpm, and the workspace installed.
  - The kit's `setup` action is that step, run right after the checkout; a
    consumer may keep its own instead.
  - **Rejected: installing Node and pnpm inside each action,** which would
    duplicate the consumer's setup, and the kit's own `setup` action (#6).
- **Node 26 or later**, since the actions' scripts are TypeScript that Node runs
  unbuilt under type stripping (see
  [Why the kit supports Node 26 only](node-26-only.md)).
  - Each action with TypeScript checks first, through
    `actions/lib/check-node.sh`, and fails naming the Node it found.
- **`@changesets/cli` 3 or later**, whose `privatePackages` defaults the actions
  read: absent means private packages are neither versioned nor tagged.
  - `pack-release` and `require-changeset` check `changeset --version`, reading
    its last line, and fail on an older or unreadable version.
  - `version-or-release` runs no code of its own: it runs after `pack-release`'s
    job, which has checked, and Changesets' sub-actions refuse a declared v2
    themselves (#23).
  - `pack-release` also fails on a publish plan in a format other than
    `version: 1`, since `changeset publish-plan --output` is experimental as of
    `@changesets/cli` 3.0.3 (#23).
  - **Rejected: supporting v2 as well,** whose defaults differ (it versions
    private packages unless told not to), so the same config would mean
    different things (#5's review).
- **A Linux or macOS runner, not Windows.**
  - The scripts run `pnpm`, `git` and `yq` without a shell, which fails on
    Windows, where pnpm is a `.cmd` shim.
  - **Rejected: limiting the actions to Linux,** as #5's review first suggested
    on the claim that Node's `path.matchesGlob` ignores case on macOS; checked
    on macOS on 2026-11-26, it doesn't, so macOS matches like
    Linux[^node-matches-glob].
- **`yq` v4 for a Renovate PR**, which `require-changeset` uses to read
  `pnpm-workspace.yaml`; GitHub's Ubuntu runners ship it.
  - **Rejected: a YAML parser dependency,** since the actions run from the
    consumer's checkout of jj-kit with no `node_modules`, so their code stays
    dependency-free.

## Why

- Failing on a too-old tool, with a message naming it, is cheaper than a check
  that quietly answers wrong.
- Every requirement but `yq` is something a kit consumer already has, since its
  own tooling runs on Node 26 and pnpm.

## Consequences

- A consumer on Windows runners runs these jobs on `ubuntu-latest` or macOS.
- Raising the Changesets CLI's major past 3 means checking its config defaults
  and the `--version` output again.

## Links

- #5, which built the actions and settled this.
- #6, the `setup` action consumers run first.
- #23, which added `pack-release`.

[^node-matches-glob]:
    `path.posix.matchesGlob` matches case-sensitively; on macOS,
    `matchesGlob("Dist/x.js", "dist/**")` returns `false`.
