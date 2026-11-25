---
type: Decision
title: Why each package is versioned on its own
description: Each package has its own SemVer version, changelog and `<name>@<version>` tag, with no Changesets `fixed` or `linked` groups, so a breaking change in one package never forces a major release of the others.
tags:
  - changelog
  - changesets
  - git-tags
  - packages
  - releases
  - semver
sources:
  - id: changesets-config
    resource: https://github.com/changesets/changesets/blob/main/docs/config-file-options.md
    title: Changesets, config file options
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T17:54:10Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# Why each package is versioned on its own

- The kit's packages change at different rates: a tsconfig base may stay put for months while the ESLint config moves weekly.

## Decision

- **As of 2026-11-25,** from `.changeset/config.json`.
- **Each package versions on its own** under SemVer, with its own `CHANGELOG.md`.
  - `fixed` and `linked` are both empty[^changesets-config].
  - **Rejected: one version for every package** (a `fixed` group), which would release every package for any change and turn one breaking change into a major for all of them.
- **A changeset names each package it bumps**, and the bump for each.
- **A dependent is bumped when the new version falls outside the range it depends on**, and `updateInternalDependencies: "patch"` updates that range on a dependent already being released.
  - Changesets reads a `workspace:*` range as the dependency's current exact version, so a `workspace:*` dependent is released with every release of its dependency.
- **Each release is tagged `<name>@<version>`**, such as `@jjloneman/kit-tsconfig@1.0.0`, not `v<version>`, since several packages share one repo.

## Why

- A consumer's Renovate update then says exactly which package changed and how much.
- A breaking change stays scoped to the one package whose API broke (#1).

## Consequences

- Each PR that ships a change must name every package it means to release.
- `kit-eslint-config` depends on `kit-eslint-plugin` as `workspace:*`, so every plugin release also patch-releases `kit-eslint-config`, which pnpm publishes pinned to the new plugin's exact version.

## Links

- #1, the roadmap's risks.
- #12, which set up Changesets.
- #3, which records this decision.

[^changesets-config]: `fixed` packages always share a version; `linked` packages share a version only when they're released together.
