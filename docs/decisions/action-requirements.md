---
type: Decision
title: What the actions require of a consumer
description:
  The kit's actions run on a Linux or macOS runner after the consumer's own
  setup step, with Node 26, pnpm, `@changesets/cli` 3 or later and, for a
  Renovate PR, pnpm 10.26 or later and `yq` v4; they fail clearly when Node or
  the Changesets CLI is too old or missing, rather than bringing their own.
tags:
  - actions
  - changesets
  - consumers
  - node
  - pnpm
  - runners
  - setup-action
  - shell
  - yaml
sources:
  - id: node-matches-glob
    resource: https://nodejs.org/api/path.html#pathmatchesglobpath-pattern
    title: Node.js, path.matchesGlob
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T05:57:29Z }
verified: { by: human:jjloneman, at: 2026-11-27T05:08:07Z }
---

# What the actions require of a consumer

- `pack-release` and `require-changeset` run TypeScript and shell out to pnpm,
  git and Changesets, and `version-or-release` runs Changesets' own sub-actions,
  so they depend on what the runner and the consumer's checkout already have.
- A missing or wrong tool otherwise shows up as a confusing failure, or worse, a
  check that passes when it shouldn't.

## Decision

- **As of 2026-11-27,** from `actions/*/action.yml`, `actions/lib/`,
  `actions/pack-release/src/`, and `main.ts` and `readers.ts` in
  `actions/require-changeset/src/`.
- **Each action runs after the consumer's own setup step**: a checkout, Node 26
  on `PATH`, pnpm, and the workspace installed.
  - The kit's `setup` action is that step, run right after the checkout; a
    consumer may keep its own instead.
  - **`version-or-release` needs only the root's `dependencies` installed**: the
    Changesets CLI, what `.changeset/config.json` loads, and, unless `format` is
    false, its formatter; so its job can pass `setup`'s `install: root` (#31).
  - **`version-or-release` checks first that `@changesets/cli` resolves from the
    repo root**, as `changesets/action` v2.1.2 resolves its `bin.js`, and fails
    naming `install: root` and the root's `dependencies` (#35).
    - Without it, a repo that passes `install: root` but keeps the CLI in
      `devDependencies` gets only the sub-action's bare resolve error.
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
  - `version-or-release` doesn't check the CLI's version: it runs after
    `pack-release`'s job, which has checked, and Changesets' sub-actions refuse
    a declared v2 themselves (#23).
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
- **pnpm 10.26 or later for a Renovate PR**, whose `pack --dry-run` lists what
  each package publishes (#27).
  - As of 2026-11-27, pnpm's docs mark `--dry-run` as added in 10.26.0.
  - A failed `pnpm pack` fails the check with a message naming that floor, so an
    older pnpm that rejects `--dry-run` fails rather than pass it; that it
    rejects it is assumed, not checked.
  - The kit itself runs on pnpm 12.
- **`yq` v4 for a Renovate PR**, which `require-changeset` uses to read
  `pnpm-workspace.yaml`; GitHub's Ubuntu runners ship it.
  - **Rejected: a YAML parser dependency,** since the actions run from the
    consumer's checkout of jj-kit with no `node_modules`, so their code stays
    dependency-free.

## Why

- Failing on a too-old tool, with a message naming it, is cheaper than a check
  that quietly answers wrong.
- Every requirement but `yq`, and the pnpm 10.26 floor on an older pnpm, is
  something a kit consumer already has, since its own tooling runs on Node 26
  and pnpm.

## Consequences

- A consumer on Windows runners runs these jobs on `ubuntu-latest` or macOS.
- Raising the Changesets CLI's major past 3 means checking its config defaults
  and the `--version` output again.

## Links

- #5, which built the actions and settled this.
- #6, the `setup` action consumers run first.
- #23, which added `pack-release`.
- #27, which added the pnpm floor for Renovate PRs.
- #31, which narrows what `version-or-release` needs installed.

[^node-matches-glob]:
    `path.posix.matchesGlob` matches case-sensitively; on macOS,
    `matchesGlob("Dist/x.js", "dist/**")` returns `false`.
