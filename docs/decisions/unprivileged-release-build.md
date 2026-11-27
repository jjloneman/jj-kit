---
type: Decision
title: Why the release builds without write access
description:
  "`release.yml` builds and packs in a job with `contents: read` alone, through
  `pack-release` and `changesets/action/pack`, and only a second job, which
  installs but never builds, holds `contents: write`, `pull-requests: write` and
  `id-token: write` to open the version PR or publish the packed tarballs,
  installing only the root's `dependencies`; neither restores the pnpm store
  cache."
tags:
  - actions
  - build
  - changesets
  - ci
  - formatting
  - github-actions
  - github-token
  - npm
  - permissions
  - pnpm
  - prettier
  - releases
  - setup-action
  - supply-chain
  - workspace
sources:
  - id: changesets-action-pack
    resource: https://github.com/changesets/action/blob/v2.1.2/pack/README.md
    title: changesets/action v2.1.2, the pack sub-action
  - id: changesets-action-run
    resource: https://github.com/changesets/action/blob/v2.1.2/src/run.ts
    title: changesets/action v2.1.2, src/run.ts
  - id: changesets-action-utils
    resource: https://github.com/changesets/action/blob/v2.1.2/src/utils.ts
    title: changesets/action v2.1.2, src/utils.ts
  - id: id-token
    resource: https://docs.github.com/en/actions/concepts/security/openid-connect
    title: GitHub Docs, OpenID Connect
  - id: pnpm-action-setup-cache
    resource: https://github.com/pnpm/action-setup/tree/v6.1.1/src
    title: pnpm/action-setup v6.1.1, its cache restore and save
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T04:33:21Z }
verified: { by: human:jjloneman, at: 2026-11-26T23:57:25Z }
---

# Why the release builds without write access

- Until #23, `release.yml`'s one job held `contents: write`, `id-token: write`
  and `pull-requests: write` while `pnpm install` and `pnpm build` ran.
- `id-token: write` lets any step of the job request an OIDC token, which npm
  trades for a publish token[^id-token]; a compromised dev dependency, or a
  build plugin, could publish with it or tamper with later steps (#5's review).

## Decision

- **As of 2026-11-26,** from `.github/workflows/release.yml`,
  `actions/pack-release/`, `actions/setup/action.yml` and
  `actions/version-or-release/action.yml`.
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
- **Neither release job uses the pnpm store cache**, through `setup`'s
  `cache: false` in both (#28).
  - With the cache on, `pnpm/action-setup` v6.1.1 restores the store saved for
    the lockfile's hash, or else the newest under a `pnpm-cache-<os>-<arch>-`
    prefix, and saves one in its post step on anything but an exact key hit,
    after the job's own steps ran[^pnpm-action-setup-cache].
  - So `ci.yml`'s jobs on `main`, which run every dev tool, save stores either
    release job would restore.
  - **The privileged job** would install from such a store while it can push and
    publish.
  - **The plan job** builds what's published, so a store poisoned by a tool that
    only `ci.yml` runs, such as an ESLint or Vitest plugin, would change the
    tarballs, though that tool never runs in the plan job.
    - **Rejected: keeping the plan job's cache and recording that risk**, which
      would leave a way to change the published code beyond the build's own
      dependencies (#28's review).
  - Only `ci.yml`'s jobs, which hold no write permission and build nothing that
    ships, keep the cache.
  - `setup` also passes `package-manager-cache: false` to `actions/setup-node`,
    whose automatic cache, as of v7.1.0, covers npm projects only, so
    `cache: false` stays the one switch if that widens.
  - **Rejected: restoring without saving, with `actions/cache/restore`**, keyed
    like `pnpm/action-setup`'s: it still restores what an unprivileged job
    saved, and adds an action pin; `pnpm/action-setup` has no restore-only mode
    of its own.
  - **`setup` warns, and leaves the cache on, in a job that can request an OIDC
    token**, which `ACTIONS_ID_TOKEN_REQUEST_URL` in its environment shows
    (#28's review).
  - **Rejected: `setup` turning the cache off itself in a privileged job**:
    nothing in the environment shows `contents: write`, or that a job builds
    what's published, so an explicit input stays the one switch.
  - **Rejected: the cache off by default**, which would cost every unprivileged
    CI job its cache.
- **The privileged job installs only the root's `dependencies`**, through
  `setup`'s `install: root`, which runs
  `pnpm install --frozen-lockfile --prod --filter .` (#31).
  - As of 2026-11-27 that's `@changesets/cli` alone: 42 packages, against the
    whole workspace's 295.
  - `changesets/action` v2.1.2 reads the CLI's range from the root
    `package.json` and resolves it from the repo root[^changesets-action-utils],
    so the CLI sits in the root's `dependencies`, which the private root never
    publishes.
  - **`install: root` needs `cache: false`**, or `setup` fails: a store saved
    from it would hold only the root's `dependencies`, under the same lockfile
    key every full install restores and then never replaces.
  - The changelog formatter imports only Node built-ins, plus types that are
    erased, so it needs nothing installed.
  - **`.changeset/config.json` sets `format: false`.**
    - Changesets 3 otherwise runs `pnpm exec prettier` on the CHANGELOGs it
      writes, which fails without Prettier installed.
    - `CHANGELOG.md` is in `.prettierignore`, so that run changed nothing: a
      version run with it off wrote the same files as one with it on.
    - It also stops `pnpm changeset` formatting the changeset files it writes;
      the pre-commit hook still formats them when they're committed.
    - **Rejected: Prettier and its plugin in the root's `dependencies` too**,
      which would install a formatter whose run changes nothing.
  - **Rejected: `--filter .` with dev dependencies**, since the root holds every
    dev tool: 219 packages.
  - **Rejected: a release-only workspace package holding the CLI**, which then
    resolves only from that package, not from the root the action reads.
  - **Rejected: `pnpm dlx` of an exact `@changesets/cli`**, which skips the
    lockfile and so the moratorium.
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
- **The privileged job still installs and runs the Changesets CLI**, whose
  publish step gets `GITHUB_TOKEN` in its environment[^changesets-action-run].
  - pnpm 12 runs no dependency's build scripts unless the workspace allows them,
    and jj-kit allows none.
- **Both release jobs install from the registry**, checked against the
  lockfile's integrity hashes, so the plan job pays a cold install on every push
  to `main`, and the release job another whenever it runs.
  - So only the build's own dependencies can change what's built, not a tool
    that runs in `ci.yml` alone.
- **A package the version or publish path needs but the root's `dependencies`
  lack fails at release time**, not in a PR's CI, since no `ci.yml` job runs the
  narrow install.
  - A consumer whose `.changeset/config.json` loads plugins, such as a changelog
    package, lists them there too, and sets `format: false` or adds its
    formatter.
- A consumer's release workflow has two jobs, as
  [Consuming the kit](../references/consuming.md) shows.
- The root's `pnpm release` script is gone, since nothing runs it.

## Links

- #5, whose review raised it.
- #23, which settled it.
- #28, which keeps the store cache out of both release jobs.
- #31, which narrows the privileged job's install.

[^changesets-action-pack]:
    `changesets/action/pack` v2.1.2 needs no job permissions, and uploads the
    pack directory as an artifact whose id it outputs.

[^changesets-action-run]:
    `runPublish` in v2.1.2 runs the publish command with `GITHUB_TOKEN` set to
    the action's token.

[^changesets-action-utils]:
    `validateChangesetsCliVersion` reads `@changesets/cli` from the root's
    `devDependencies` or `dependencies`, and `resolveChangesetsCli` calls
    `require.resolve("@changesets/cli/bin.js")` from the working directory.

[^id-token]:
    With `id-token: write`, a job's steps get `ACTIONS_ID_TOKEN_REQUEST_URL` and
    `ACTIONS_ID_TOKEN_REQUEST_TOKEN`, so any of them can request a token.

[^pnpm-action-setup-cache]:
    In v6.1.1, `src/cache-restore/run.ts` restores with that prefix as a restore
    key, `src/cache-save/run.ts` saves unless the restored key equals the
    primary one, and both return early when `cache` is false.
