---
type: Decision
title: How the repo and its packages are named
description: The repo is `jj-kit`, and each package is `@jjloneman/kit-<name>` under the owner's existing npm scope, so the packages sort together and Renovate can group them by prefix.
tags:
  - naming
  - npm
  - npm-scope
  - packages
  - renovate
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T18:01:48Z }
---

# How the repo and its packages are named

- The kit needs a repo name, and its packages need npm names that read as one family.

## Decision

- **As of 2026-11-25.**
- **The repo is `jj-kit`**, and the root `package.json`, which is private, is named `jj-kit` too.
- **Each package is `@jjloneman/kit-<name>`**, under the owner's existing `@jjloneman` npm scope:
  - `kit-changesets-changelog`;
  - `kit-eslint-config`;
  - `kit-eslint-plugin`;
  - `kit-git-hooks`;
  - `kit-prettier-config`;
  - `kit-tsconfig`.
- **Each action is named for what it does**, with no prefix, since its path already names the repo: `jjloneman/jj-kit/actions/<name>`.
- **A package's folder drops the prefix:** `packages/<name>/`, which is also the commit scope (`feat(eslint-config): ✨ …`).

## Why

- The shared `kit-` prefix sorts the packages together in a `package.json` and on npm.
- Renovate can group every kit update by the `@jjloneman/kit-` prefix.
- The existing scope needs no new npm organization, and is already excluded from the owner's dependency moratorium as `@jjloneman/*`.

## Consequences

- The owner's other `@jjloneman` packages, such as okf-tools, share the scope but not the prefix, so a prefix rule picks out only the kit.

## Links

- #1, the roadmap.
- #3, which records this decision.
