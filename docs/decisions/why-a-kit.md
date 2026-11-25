---
type: Decision
title: Why a kit of packages and actions
description:
  Shared tooling ships as published `@jjloneman/kit-*` npm packages plus
  composite GitHub Actions that each repo depends on and pins; not a template
  repo, whose copies drift, or a central runner, which leaves repos unable to
  run their own checks.
tags:
  - actions
  - ci
  - consumers
  - dogfooding
  - drift
  - packages
  - renovate
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T18:05:50Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# Why a kit of packages and actions

- Each of the owner's repos copied the same ESLint, Prettier, TypeScript, git
  hook, changelog and CI setup, and the copies drifted (#1).
  - One local ESLint rule existed in 4 versions across 5 repos (#1, #9).
  - The pre-commit hook was a shell script of about 90 lines, copied into 7
    repos in 2 versions (#11).
  - Some repos' changeset checks skipped the version PR but not Renovate
    branches, and some had no check at all (#5).

## Decision

- **As of 2026-11-25.**
- **Configs and scripts ship as npm packages** under `@jjloneman/kit-*`, which
  each repo installs as exact-pinned dev dependencies.
  - **Rejected: a template repo.** Its copies drift the day they're made, which
    is the problem the kit exists to solve.
  - **Rejected: a central runner that lints every repo.** Repos would stop being
    self-contained, and couldn't run their own checks locally.
- **CI steps ship as composite GitHub Actions** in `actions/<name>`, which a
  repo pins by SHA.
  - So a check such as the changeset check is one shared action rather than a
    step copied into each CI file;
    [Why every PR adds a changeset](changeset-every-pr.md) holds the rule
    itself.
- **jj-kit is its own first consumer:** each package PR replaces the copy the
  scaffold took from okf-tools with the package, in the same PR (#1).
- **Out of scope:** migrating the owner's other repos onto the kit, which is
  tracked elsewhere (#1).

## Why

- A fix lands once, in one package, and Renovate carries it to every repo as an
  ordinary dependency bump.
- Each repo still holds a complete, runnable setup, through its own lockfile and
  `node_modules`, so `pnpm check` works offline and in CI the same way.
- Shared TypeScript code is tested once, with a coverage gate, rather than
  trusted as a copy.

## Consequences

- A breaking change reaches every consumer at once through Renovate's update, so
  [each package is versioned on its own](independent-versions.md) to keep a
  break scoped to one package.
- Every kit release sits out consumers' dependency moratorium unless they
  exclude `@jjloneman/*`, as [Consuming the kit](../references/consuming.md)
  shows.
- Until each package or action ships, jj-kit runs on copies from okf-tools, each
  headed with the issue that replaces it: the ESLint config and its local rule,
  the Prettier config, the root `tsconfig.json`, the git hooks and the setup
  action.
  - `ci.yml`'s changeset job and `release.yml` are adapted from okf-tools rather
    than copied, and say which issue replaces them in their own comments.

## Links

- #1, the roadmap.
- #3, which records this decision.
