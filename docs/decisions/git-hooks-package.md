---
type: Decision
title: Why git hooks ship as a package
description: Hook logic ships in `kit-git-hooks` as the `kit-pre-commit` and `kit-pre-push` commands, written in tested TypeScript, so each repo's hook file is one line that runs them; not a shell script copied into every repo.
tags:
  - git-hooks
  - kit-git-hooks
  - pre-commit
  - pre-push
  - shell
  - testing
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T17:54:10Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# Why git hooks ship as a package

- The owner's pre-commit hook was a shell script of about 90 lines, copied into 7 repos in 2 versions (#11).
- jj-kit's own `.githooks/` are still copies from okf-tools, with known gaps #2's review left for #11.

## Decision

- **As of 2026-11-25,** as #11 plans it; `kit-git-hooks` isn't built yet.
- **Hook logic ships as two commands** in `@jjloneman/kit-git-hooks`:
  - `kit-pre-commit` runs ESLint `--fix` and Prettier `--write` over the staged files, re-stages only the files a tool rewrote, and aborts the commit on an error it can't fix;
  - `kit-pre-push` runs `pnpm typecheck`, and `pnpm test` too with `--test`.
- **Each repo's hook file is one line**, with `core.hooksPath` set by the `prepare` script:

  ```sh
  #!/bin/sh
  exec pnpm exec kit-pre-commit
  ```

  - **Rejected: a shared shell script,** which would still be copied, and can't be unit-tested to the kit's coverage gate.

- **The logic is TypeScript**, running git and each tool through `child_process` with argument arrays, never a shell string.
- **ESLint and Prettier are optional peers**, run through `pnpm exec`; repos that don't use pnpm are out of scope.
- **Repo-specific hooks stay local**, such as a hook that lints zsh scripts.

## Why

- A fix to the hooks, such as handling a path git quotes, lands once and reaches every repo through Renovate.
- Tested TypeScript can cover the edge cases the shell copies got wrong.

## Consequences

- A consumer needs the package installed before its hooks run, which `pnpm install` already guarantees.
- jj-kit replaces its own `.githooks/` with the one-line form in #11.

## Links

- #11, which builds `kit-git-hooks`.
- #3, which records this decision.
