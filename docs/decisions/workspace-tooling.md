---
type: Decision
title: How the monorepo is built
description:
  A plain pnpm workspace with Changesets, and no monorepo framework such as Nx,
  Turborepo or Lerna; shared versions live in a pnpm catalog, packages depend on
  each other as `workspace:*`, tsdown builds them and publint plus attw check
  what they publish.
tags:
  - attw
  - build
  - catalog
  - changesets
  - kit-changesets-changelog
  - monorepo
  - packages
  - pnpm
  - publint
  - tsdown
  - workspace
sources:
  - id: pnpm-catalogs
    resource: https://pnpm.io/catalogs
    title: pnpm, catalogs
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T23:18:56Z }
verified: { by: human:jjloneman, at: 2026-11-26T01:05:37Z }
---

# How the monorepo is built

- jj-kit holds several npm packages that build, test and release on their own,
  from one repo.

## Decision

- **As of 2026-11-25,** from `pnpm-workspace.yaml`, `package.json` and
  `.changeset/config.json`.
- **A plain pnpm workspace:** `packages: [packages/*]` in `pnpm-workspace.yaml`.
  - **Rejected: Nx, Turborepo and Lerna.** No thread records the owner's
    reasons; the drafter's reading is in Why below, for the owner to confirm at
    sign-off.
- **Changesets versions and publishes** each package (see
  [Independent versions](independent-versions.md)).
- **Shared dev dependency versions live in the workspace's `catalog`**,
  referenced as `catalog:`[^pnpm-catalogs], so one bump moves every package
  together.
  - As of 2026-11-25 it holds TypeScript, `@types/node`, ESLint,
    typescript-eslint and `@typescript-eslint/utils` (which move together),
    Prettier, Vitest and `@vitest/coverage-v8`, tsdown, publint and attw.
- **Packages depend on each other as `workspace:*`**, which pnpm rewrites to the
  exact version on publish.
- **Versions are exact** (`saveExact: true`), so the lockfile is the only thing
  that moves a dependency.
- **Each package that builds code builds with its own `tsdown.config.ts`**, into
  `dist/`; a JSON-only package such as `kit-tsconfig` has none.
  - As of 2026-11-25, `kit-changesets-changelog` (#4) is the first.
- **Each package checks what it publishes** with a `lint:package` script,
  `pnpm build && publint && attw --pack --profile esm-only`, which CI's
  `📦 Package` job runs wherever it's defined.
  - A package that ships only JSON, such as `kit-tsconfig`, skips attw (#8).
- **Root scripts run across the workspace** with `pnpm -r --if-present`, and
  `pnpm check` runs lint, format, typecheck, tests with coverage and the package
  checks; only the `🦋 Changeset` check is left to CI.

## Why

- pnpm's workspace, catalog and `-r` already cover what a handful of small
  packages need: linking, shared versions and running a script in each.
- A framework would add its own config, cache and task graph to learn and keep
  up to date, for builds that take seconds.
- Changesets is pnpm-aware and handles per-package versions, changelogs and
  publishing, which is the part a workspace lacks.

## Consequences

- There's no build cache or affected-package detection; every CI run builds and
  tests every package.
- Adding a framework later stays possible, since nothing here depends on one's
  absence.

## Links

- #2, the scaffold.
- #3, which records this decision.

[^pnpm-catalogs]:
    A pnpm catalog defines a dependency's version once in `pnpm-workspace.yaml`,
    for packages to reference as `catalog:`.
