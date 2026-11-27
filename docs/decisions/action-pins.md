---
type: Decision
title: How the actions' own dependencies are pinned
description:
  Every third-party action the kit's actions and jj-kit's workflows use is
  pinned by full commit SHA with its exact tag in a comment, which Renovate's
  built-in `github-actions` manager reads and updates; not by tag, which the
  upstream can move under every consumer at once.
tags:
  - actions
  - changesets
  - consumers
  - dogfooding
  - github-actions
  - pinning
  - renovate
  - setup-action
  - supply-chain
sources:
  - id: github-actions-hardening
    resource: https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions
    title: GitHub Docs, secure use of third-party actions
  - id: renovate-github-actions
    resource: https://docs.renovatebot.com/modules/manager/github-actions/
    title: Renovate, the github-actions manager
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T23:33:49Z }
---

# How the actions' own dependencies are pinned

- A consumer pins each kit action by SHA (see
  [How the actions are versioned](action-versions.md)), but a composite action's
  own `uses:` steps resolve when it runs.
- With those steps pinned by tag, a moved or compromised upstream tag reaches
  every consumer at once, whatever the consumer pinned.

## Decision

- **As of 2026-11-27,** from `actions/*/action.yml` and `.github/workflows/`.
- **Every third-party action is pinned by full commit SHA, with its exact tag in
  a comment:**

  ```yaml
  uses: actions/setup-node@<sha> # v7.1.0
  ```

  - The SHA is the commit the tag points to, peeled for an annotated tag, such
    as `pnpm/action-setup`'s and `changesets/action`'s.
  - **Rejected: pinning by tag**, such as `@v7.1.0`, which the upstream can move
    to any commit[^github-actions-hardening].
  - **Rejected: a workflow lockfile, for now**, which the same docs recommend
    over SHA pins for a repo that can adopt one; whether it would also freeze a
    composite action's own steps for its consumers isn't checked.

- **Two checks enforce it:**
  - the local ESLint rule `local/pinned-uses` fails a `uses:` that's neither a
    local path, an image pinned by `sha256` digest nor a full SHA with its
    `# vX.Y.Z` on the same line;
  - `.github/scripts/check-action-pins.sh`, a step of `ci.yml`'s
    `🧹 Lint & format`, asks GitHub for each tag's commit and fails a SHA that
    doesn't match, such as a SHA copied from the wrong tag or repo.
  - **Rejected: a workflow auditor such as zizmor**, for now; it audits much
    more than pins, and adopting it is a CI change of its own.

- **jj-kit's own workflows pin the same way**, such as `actions/checkout` in
  `ci.yml` and `release.yml`.
  - `release.yml`'s jobs hold `id-token: write` and write access, so a moved tag
    there could publish to npm.
  - **Rejected: pinning only the actions**, which leaves the jobs with the most
    access on tags.
- **The kit's own actions stay local paths** in jj-kit's workflows,
  `./actions/<name>`, so a PR's CI runs them as that PR changes them.
- **Renovate's built-in `github-actions` manager reads these pins and proposes
  their updates**[^renovate-github-actions].
  - Checked on 2026-11-27 with Renovate 44.255.2, in a `--platform=local` dry
    run:
    - on the branch, it read every pin in the three actions and the two
      workflows, with no update proposed;
    - in a scratch copy with `setup-node` set back to v7.0.0 and the three
      `changesets/action` pins to v2.1.1, it proposed v7.1.0 and v2.1.2 at their
      tags' commits;
    - all three `changesets/action` pins went to one branch,
      `renovate/changesets-action-2.x`, so no `packageRules` group is needed to
      keep them together.
    - A lookup dry run stops before writing a branch, so the rewrite of the SHA
      and its comment wasn't run; it rests on Renovate's docs.
  - As of 2026-11-27, Renovate doesn't run on jj-kit, so the pins are bumped by
    hand until it does.

## Why

- A consumer's SHA pin of a kit action then freezes every action step it runs,
  so a new upstream step reaches a consumer only through a kit release they
  take.
  - The tools those steps download, such as Node and pnpm, are pinned by version
    instead, and `@changesets/cli` is whatever the consumer installed.
- The tag comment keeps the version readable in review, and is what Renovate
  reads to find the next release.

## Consequences

- Each pin bump in an `action.yml` changes a file that action ships, so it needs
  a changeset releasing that action, a Renovate PR's included.
- A bump in a workflow alone ships nothing: a Renovate PR passes the
  `🦋 Changeset` check with no changeset, and any other PR takes an empty one.
- A bump also updates each comment or doc that describes the current pin, but
  leaves dated statements and record sources, which name the version they were
  checked against, until their claim is re-checked.
- Sub-actions of one repo share a SHA and move together.

## Links

- #39, which pinned them.
- #24, which added the Renovate preset for consumers' pins of the kit's actions.

[^github-actions-hardening]:
    For a repo that can't adopt a workflow lockfile, the docs advise pinning an
    action to a full-length commit SHA, or to a tag only if you trust its
    creator, since a tag can be moved or deleted.

[^renovate-github-actions]:
    The manager reads a SHA-pinned action's version from a comment such as
    `# v4.0.0` and updates the SHA to the tag it names; a bare SHA pin with no
    version comment is disabled by default.
