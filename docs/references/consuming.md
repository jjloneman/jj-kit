---
type: Reference
title: Consuming the kit
description:
  How a repo installs and wires each kit package and action, pins actions by SHA
  with a version comment, and excludes `@jjloneman/*` from its own dependency
  moratorium.
tags:
  - actions
  - changelog
  - changesets
  - ci
  - consumers
  - kit-changesets-changelog
  - moratorium
  - node
  - packages
  - pinning
  - pull-requests
  - releases
  - renovate
  - setup-action
  - version-pr
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-26T22:04:04Z }
verified: { by: human:jjloneman, at: 2026-11-26T19:29:41Z }
---

# Consuming the kit

- **As of 2026-11-26,** `kit-changesets-changelog` and the `pack-release`,
  `require-changeset`, `setup` and `version-or-release` actions are built; no
  other package or action is.
- Each section below is filled in by the PR that ships it.
- For a reader in another repo: what to install, what to write, and what to
  delete.

## Requirements

- **Node 26 and pnpm** for the repo's tooling, whatever Node its own published
  code supports (see
  [Why the kit supports Node 26 only](../decisions/node-26-only.md)).
- **For the actions, a Linux or macOS runner and `@changesets/cli` 3 or later**
  (see
  [What the actions require of a consumer](../decisions/action-requirements.md)).
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

- **Install it**, then name it in `.changeset/config.json`:

  ```json
  { "changelog": "@jjloneman/kit-changesets-changelog" }
  ```

- **Delete** any copied formatter script and the `changelog` path that loaded
  it.
- **Run `changeset version` from the repo root**, since the formatter reads git
  from the current directory; the changesets CLI and action already do.
- **Keep PR titles conventional**, `<type>(<scope>): <gitmoji> <subject>`, since
  each squash commit's subject becomes its changelog line's prefix.

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

- **Pin each action by full commit SHA, with its tag in a comment**, so the pin
  can't move and the version stays readable:

  ```yaml
  - uses: jjloneman/jj-kit/actions/<name>@<sha> # <name>@<version>
  ```

  - Each action has its own `<name>@<version>` tag and `CHANGELOG.md` (see
    [How the actions are versioned](../decisions/action-versions.md)).
  - **Renovate's built-in `github-actions` manager can't update these pins**, so
    bump them by hand until the kit ships a Renovate preset for them.

- **Run `setup` before the others**, after the checkout, so they find pnpm, Node
  26 and the workspace installed.
  - It installs only what the repo's lockfile lists, so the repo itself depends
    on `@changesets/cli` 3 or later.

### require-changeset

- **Replace the inline changeset job's steps** with the action, and keep the
  job's name if it's a required check:

  ```yaml
  changeset:
    name: 🦋 Changeset
    if: ${{ github.event_name == 'pull_request' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: jjloneman/jj-kit/actions/setup@<sha> # setup@<version>
      - uses: jjloneman/jj-kit/actions/require-changeset@<sha> # require-changeset@<version>
  ```

- **`fetch-depth: 0` is required**; the action fails on a shallow checkout.
- **To spare the version PR a checkout and install**, skip the job for it, as
  jj-kit's own `ci.yml` does; a skipped required job counts as passing.
- **A self-hosted Renovate** passes its login in `renovate-authors`, and a
  custom `branchPrefix` in `renovate-branches`.
- **A version PR opened with another token**, such as a GitHub App's, passes
  that token's login in `version-pr-authors`.
- **Delete** any copied changeset check or Renovate "ships" script.

### setup

- **Replace the repo's own setup steps**, or its local `.github/actions/setup`,
  with the action, right after the checkout:

  ```yaml
  steps:
    - uses: actions/checkout@<sha> # v7.0.1
      with:
        persist-credentials: false

    - uses: jjloneman/jj-kit/actions/setup@<sha> # setup@<version>
    - run: pnpm test
  ```

- **It reads pnpm's version from `packageManager`** in the root `package.json`,
  so it takes no pnpm input.
- **It installs Node 26 unless told otherwise.**
  - Only a job that tests the repo's own published code on an older Node passes
    `node-version`, such as `"24"` (see
    [Why the kit supports Node 26 only](../decisions/node-26-only.md)).
  - A repo whose `devEngines` refuses older Node, as jj-kit's does, can't run
    such a job.
- **Keep extra setup**, such as a browser install or a second lockfile, as a
  local step after this one.
- **Delete** the repo's own `.github/actions/setup` once every job uses the
  action.

### pack-release and version-or-release

- **They replace the release job's `changesets/action` step**, and any step that
  labels the version PR, as two jobs: `pack-release` in a job with no write
  access, then `version-or-release` in one that holds the permissions.
  - A step that sets inputs neither action passes on, such as `version-script`,
    `cwd`, `pr-draft`, `create-github-releases` or `push-git-tags`, keeps
    `changesets/action` for now.
  - **`build-script` replaces the build half of the old `publish-script`**, such
    as `pnpm build` for a `pnpm release` of `pnpm build && changeset publish`;
    `changesets/action/publish` runs the publish.

  ```yaml
  plan:
    if: ${{ github.ref == 'refs/heads/main' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      next: ${{ steps.pack.outputs.next }}
      pack-dir-artifact-id: ${{ steps.pack.outputs.pack-dir-artifact-id }}
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          fetch-tags: true
          persist-credentials: false

      - uses: jjloneman/jj-kit/actions/setup@<sha> # setup@<version>

      - id: pack
        uses: jjloneman/jj-kit/actions/pack-release@<sha> # pack-release@<version>
        with:
          build-script: pnpm build

  release:
    needs: plan
    if: ${{ needs.plan.outputs.next != 'none' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
      pull-requests: write
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with:
          persist-credentials: false

      - uses: jjloneman/jj-kit/actions/setup@<sha> # setup@<version>

      - uses: jjloneman/jj-kit/actions/version-or-release@<sha> # version-or-release@<version>
        with:
          assignee: <login>
          github-token: ${{ secrets.GITHUB_TOKEN }}
          next: ${{ needs.plan.outputs.next }}
          pack-dir-artifact-id: ${{ needs.plan.outputs.pack-dir-artifact-id }}
  ```

- **Give the plan job no write permission**: its build runs every dev
  dependency's code (see
  [Why the release builds without write access](../decisions/unprivileged-release-build.md)).
- **Fetch the tags in the plan job's checkout**, with `fetch-tags: true`.
  - Without them, Changesets asks `git ls-remote`, which fails in a private repo
    once `persist-credentials` is off, so every private package looks untagged
    and each run tries to tag it again.
- **Pass `build-script` whenever anything publishes to npm**, or `"true"` when
  nothing needs building; left empty, `pack-release` fails rather than publish
  packages without their build output.
- **Drop any manual recovery for a merge that published nothing**: the next run
  with no releasing changeset pending publishes it.
- **The repo allows GitHub Actions to create pull requests**, in Settings →
  Actions → General, and has a `🚀 release` label.
- **Its version PR's CI run waits for an approval click** each release (see
  [Which token opens the version PR](../decisions/version-pr-token.md)).
