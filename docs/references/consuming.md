---
type: Reference
title: Consuming the kit
description:
  How a repo installs and wires each kit package and action, pins actions by SHA
  with a version comment, and excludes `@jjloneman/*` from its own dependency
  moratorium.
tags:
  - actions
  - consumers
  - moratorium
  - packages
  - pinning
  - renovate
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T17:54:10Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# Consuming the kit

- **As of 2026-11-25,** no package or action is published yet; each section
  below is filled in by the PR that ships it.
- For a reader in another repo: what to install, what to write, and what to
  delete.

## Requirements

- **Node 26 and pnpm** for the repo's tooling, whatever Node its own published
  code supports (see
  [Why the kit supports Node 26 only](../decisions/node-26-only.md)).
- **Install every package as an exact-pinned dev dependency:**

  ```sh
  pnpm add --save-dev --save-exact @jjloneman/kit-<name>
  ```

## Dependency moratorium

- **A repo with a release-age floor excludes the owner's own packages**, so a
  kit release, including a fix, is usable the day it ships:

  ```yaml
  # pnpm-workspace.yaml
  minimumReleaseAge: 10080
  minimumReleaseAgeExclude:
    - "@jjloneman/*"
  ```

- The kit's own dependencies still go through the floor, since they come from
  other publishers.

## Packages

### kit-changesets-changelog

- 🚧 Coming in #4.

### kit-eslint-config

- 🚧 Coming in #10.

### kit-eslint-plugin

- 🚧 Coming in #9.

### kit-git-hooks

- 🚧 Coming in #11.

### kit-prettier-config

- 🚧 Coming in #7.

### kit-tsconfig

- 🚧 Coming in #8.

## Actions

- **Pin each action by full commit SHA, with the version in a comment**, so the
  pin can't move and Renovate can still read the version:

  ```yaml
  - uses: jjloneman/jj-kit/actions/<name>@<sha> # <name>@<version>
  ```

  - The `<name>@<version>` comment assumes each action gets its own tag, which
    #5 decides; until then this format is pending.
  - Whether Renovate updates a pin on a path inside a repo this way is assumed,
    not yet checked; #5 checks it.

### require-changeset

- 🚧 Coming in #5.

### setup

- 🚧 Coming in #6.

### version-or-release

- 🚧 Coming in #5.
- **The repo allows GitHub Actions to create pull requests**, in Settings →
  Actions → General, and has a `🚀 release` label.
- **Its version PR's CI run waits for an approval click** each release (see
  [Which token opens the version PR](../decisions/version-pr-token.md)).
