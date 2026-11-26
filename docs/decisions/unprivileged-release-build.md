---
type: Decision
title: Why the release builds without write access
description:
  "`release.yml` builds and packs in a job with `contents: read` alone, through
  `pack-release` and `changesets/action/pack`, and only a second job, which
  installs but never builds, holds `contents: write`, `pull-requests: write` and
  `id-token: write` to open the version PR or publish the packed tarballs."
tags:
  - actions
  - build
  - changesets
  - ci
  - github-actions
  - github-token
  - npm
  - permissions
  - releases
  - supply-chain
sources:
  - id: changesets-action-pack
    resource: https://github.com/changesets/action/blob/v2.1.2/pack/README.md
    title: changesets/action v2.1.2, the pack sub-action
  - id: changesets-action-run
    resource: https://github.com/changesets/action/blob/v2.1.2/src/run.ts
    title: changesets/action v2.1.2, src/run.ts
  - id: id-token
    resource: https://docs.github.com/en/actions/concepts/security/openid-connect
    title: GitHub Docs, OpenID Connect
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-26T22:04:04Z }
verified: { by: human:jjloneman, at: 2026-11-26T22:42:26Z }
---

# Why the release builds without write access

- Until #23, `release.yml`'s one job held `contents: write`, `id-token: write`
  and `pull-requests: write` while `pnpm install` and `pnpm build` ran.
- `id-token: write` lets any step of the job request an OIDC token, which npm
  trades for a publish token[^id-token]; a compromised dev dependency, or a
  build plugin, could publish with it or tamper with later steps (#5's review).

## Decision

- **As of 2026-11-26,** from `.github/workflows/release.yml`,
  `actions/pack-release/` and `actions/version-or-release/action.yml`.
- **`release.yml` runs two jobs:**
  - `📦 Plan and pack`, with `contents: read` alone: `setup`, then
    `pack-release`, which decides `version`, `publish` or `none` (see
    [Why empty changesets don't block a publish](publish-past-empty-changesets.md)),
    and when publishing runs `pnpm build` and `changesets/action/pack`, which
    runs `changeset pack` and uploads the tarballs and their plan as an
    artifact[^changesets-action-pack];
  - `🦋 Version PR or publish`, only while `next` isn't `none`, with the write
    permissions: `setup`, then `version-or-release`, which runs
    `changesets/action/version`, or `changesets/action/publish` on the artifact,
    with no build.
- **The kit's actions wrap Changesets' own sub-actions** rather than packing and
  passing artifacts themselves (#23).
  - So the tarballs, their checksums and the plan travel in Changesets' own
    format, and no `download-artifact` pin is added.
  - **Rejected: running `changeset pack` with `actions/upload-artifact`, and
    `actions/download-artifact` before the main `changesets/action`,** as #23's
    plan first had it: another action to pin, and a set-aside of the empty
    changesets the main action would still need.
  - **`pack-release` uploads the plan it checked**, with
    `actions/upload-artifact`, and passes its id to `pack`, so what's packed is
    what passed the `0.0.0` hold-back and the build check (#23's review).
    - **Rejected: letting `pack` work out the plan again**, which a flaky tag
      lookup could change, and which asks the registry twice.
- **Version and publish share the privileged job.**
  - **Rejected: a third job, so the version path never holds
    `id-token: write`.** It runs only the Changesets CLI and the changelog
    formatter, the same code the publish path runs, so the extra job would add
    YAML to every consumer for little gain (#23).
- **Rejected: one action with a `mode` input** for both jobs, whose inputs and
  outputs would be half unused in each (#23).

## Why

- Building is where most third-party code runs: tsdown, its plugins and every
  dev dependency they load.
- A job that can't push or mint a publish token can't leak either.

## Consequences

- **A compromised build dependency can still change what's built**, and so what
  the release job publishes; the split stops it pushing or publishing on its
  own, not poisoning the tarballs.
  - npm's provenance still names `release.yml`.
- **The privileged job still installs the workspace and runs the Changesets
  CLI**, whose publish step gets `GITHUB_TOKEN` in its
  environment[^changesets-action-run].
  - pnpm 12 runs no dependency's build scripts unless the workspace allows them,
    and jj-kit allows none.
- A consumer's release workflow has two jobs, as
  [Consuming the kit](../references/consuming.md) shows.
- The root's `pnpm release` script is gone, since nothing runs it.

## Links

- #5, whose review raised it.
- #23, which settled it.

[^changesets-action-pack]:
    `changesets/action/pack` v2.1.2 needs no job permissions, and uploads the
    pack directory as an artifact whose id it outputs.

[^changesets-action-run]:
    `runPublish` in v2.1.2 runs the publish command with `GITHUB_TOKEN` set to
    the action's token.

[^id-token]:
    With `id-token: write`, a job's steps get `ACTIONS_ID_TOKEN_REQUEST_URL` and
    `ACTIONS_ID_TOKEN_REQUEST_TOKEN`, so any of them can request a token.
