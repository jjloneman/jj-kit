---
type: Reference
title: Consuming the kit
description:
  How a repo installs and wires each kit package and action, pins actions by SHA
  with a version comment that the kit's Renovate preset updates, and excludes
  the kit from its own dependency moratorium.
tags:
  - actions
  - changelog
  - changesets
  - ci
  - consumers
  - kit-changesets-changelog
  - kit-prettier-config
  - kit-tsconfig
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
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-28T08:36:25Z }
verified: { by: human:jjloneman, at: 2026-11-27T23:26:20Z }
---

# Consuming the kit

- **As of 2026-11-28,** `kit-changesets-changelog`, `kit-prettier-config`,
  `kit-tsconfig` and the `pack-release`, `require-changeset`, `setup` and
  `version-or-release` actions are built; no other package or action is.
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

  - `kit-changesets-changelog` is the exception in a workspace whose release job
    passes `install: root`; see [its section](#kit-changesets-changelog).

## Dependency moratorium

- **A repo with a release-age floor excludes the owner's own packages**, so a
  kit release, including a fix, is usable the day it ships:

  ```yaml
  # pnpm-workspace.yaml
  minimumReleaseAge: 10080
  minimumReleaseAgeExclude:
    - "@jjloneman/*"
  ```

- **A repo whose Renovate config sets `minimumReleaseAge` exempts the kit there
  too**, since Renovate doesn't read pnpm's exclusion: the packages by
  `@jjloneman/*`, and the actions, whose updates come from git tags, by
  `jjloneman/jj-kit`.
  - Put the rule last in `packageRules`, since a later rule that sets
    `minimumReleaseAge` wins.

  ```json
  {
    "packageRules": [
      {
        "matchPackageNames": ["@jjloneman/*", "jjloneman/jj-kit"],
        "minimumReleaseAge": "0 days"
      }
    ]
  }
  ```

- The kit's own dependencies still go through the floor, since they come from
  other publishers.

## Packages

### kit-changesets-changelog

- **Install it**, then name it in `.changeset/config.json`:

  ```json
  { "changelog": "@jjloneman/kit-changesets-changelog" }
  ```

  - **In a workspace whose release job passes `setup`'s `install: root`**,
    install it into the root's `dependencies` instead, with `@changesets/cli`,
    which it peers on, since that job installs nothing else:

    ```sh
    pnpm add --save-exact -w @jjloneman/kit-changesets-changelog
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

- **Install it with `prettier`**, then delete the repo's own
  `prettier-plugin-sh` and `sh-syntax`, which it brings.
- **Re-export it** as the repo's `prettier.config.ts`:

  ```ts
  export { default } from "@jjloneman/kit-prettier-config";
  ```

  - A repo with zsh scripts names them instead:
    `export default createZshConfig({ files: ["bin/*"] })`, from
    `@jjloneman/kit-prettier-config/zsh`.

- **Keep the repo's own settings by spreading the base**, then adding to its
  `OVERRIDES` and `PLUGINS` exports, since setting `overrides` or `plugins`
  replaces the base's; its [README](../../packages/prettier-config/README.md)
  has the example.
  - Typical keepers: a `proseWrap` override for the repo's Markdown, and
    language plugins such as `prettier-plugin-toml`, listed by name.
- **Drop `prettier-plugin-packagejson`** if the repo sorts `package.json` with
  the kit's ESLint config, or the two fight over key order.
- **Expect a one-time diff** in a repo that used other `trailingComma` settings.

### kit-tsconfig

- **Install it**, with `typescript` 6 and, for `node.json` or `lib.json`,
  `@types/node` at the oldest Node the repo's published code supports.
- **Extend one base by how the code runs**, keeping `include`, `outDir` and
  `rootDir` in the repo's own `tsconfig.json`, since they resolve against the
  file that sets them:

  ```json
  {
    "extends": "@jjloneman/kit-tsconfig/node.json",
    "include": ["src", "*.config.ts"]
  }
  ```

  - `node.json` for code Node runs under type stripping, `bundler.json` for
    bundled code, and `lib.json` for a published package.
  - **Compose two with an `extends` array**, later ones winning, such as
    `["@jjloneman/kit-tsconfig/lib.json", "@jjloneman/kit-tsconfig/node.json"]`
    for a package whose source Node also runs directly, as jj-kit's own configs
    do.

- **Delete every option the base already sets**, keeping only the repo's own.
  - Relative imports under `node.json` and `lib.json` need a file extension;
    `node.json` takes the `.ts` name, and `lib.json` alone the emitted `.js`.
- **`node.json` and `lib.json` need `"type": "module"`** in the repo's
  `package.json`: under `nodenext`, `verbatimModuleSyntax` rejects importing or
  exporting a value in a CommonJS file (TS1295, TS1287).
- **A `lib.json` package that tsdown builds sets `noEmit: true`**, unless it
  also extends `node.json`, or a plain `tsc` typecheck writes `.js` and `.d.ts`
  files beside its sources.
- **A `lib.json` package that emits with tsc sets `outDir` and `rootDir`**;
  TypeScript 6 reports TS5011 when `outDir` is set without `rootDir`.
- **A web app on `bundler.json` adds `"dom"` to `lib`**, as `["es2025", "dom"]`.
- **A package that supports a Node older than 26** lowers `target` and `lib`
  from `es2025` to match.

## Actions

- **Pin each action by full commit SHA, with its tag in a comment**, so the pin
  can't move and the version stays readable:

  ```yaml
  - uses: jjloneman/jj-kit/actions/<name>@<sha> # <name>@<version>
  ```

  - Each action has its own `<name>@<version>` tag and `CHANGELOG.md` (see
    [How the actions are versioned](../decisions/action-versions.md)).
  - **Renovate's built-in `github-actions` manager can't update these pins**, so
    extend the kit's preset, which turns that manager off for the kit's actions
    and updates the SHA and the comment together:

    ```json
    { "extends": ["github>jjloneman/jj-kit//renovate/actions"] }
    ```

  - **Only a pin in that form gets updates**, `@<sha> # <name>@<x.y.z>` on one
    line, quotes allowed; the preset turns the built-in manager off for every
    kit pin, so one with no comment, or a comment in another form, never moves.
  - **The comment's name must match the action in the path**: Renovate looks up
    the path's action and doesn't check the comment, so
    `setup@<sha> # pack-release@0.3.0` would get `setup`'s version under
    `pack-release`'s name.
  - **Its updates come from the `custom.regex` manager**, with the package name
    `jjloneman/jj-kit` and the dep type `action`.
    - A `packageRules` entry keyed on `matchManagers: ["github-actions"]`
      doesn't reach them; key it on `matchDepTypes: ["action"]` instead, which
      both managers set, or give the kit's pins a rule of their own with
      `matchPackageNames: ["jjloneman/jj-kit"]`.
    - A repo that sets `enabledManagers` lists `custom.regex` in it, or the
      kit's pins get no updates and no warning.
  - The preset is read from jj-kit's `main`, unversioned, so a change to it
    reaches every consumer on Renovate's next run.

- **Run `setup` before the others**, after the checkout, so they find pnpm, Node
  26 and the workspace installed.
  - It installs only what the repo's lockfile lists, so the repo itself depends
    on `@changesets/cli` 3 or later, in its root's `dependencies` when the
    release job passes `install: root`.

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
- **It caches the pnpm store**, restoring it and saving it on a miss after the
  job's own steps ran.
  - **A job with write permissions or `id-token: write`, or one that builds
    what's published, passes `cache: false`**, such as both release jobs below.
  - It needs `setup` 0.2.0 or later; an older pin only warns about the unknown
    input and keeps the cache on.
  - A store saved by a job that ran every dev tool could otherwise reach the
    published build or the job that can push and publish, and as of
    `pnpm/action-setup` v6.1.1 there's no restore-only mode (see
    [Why the release builds without write access](../decisions/unprivileged-release-build.md)).
  - A job that can request an OIDC token gets a warning while the cache is on;
    one holding only `contents: write` doesn't, since nothing in its environment
    shows it.
- **It installs the whole workspace unless told otherwise.**
  - **`install: root` installs only the root's `dependencies`**, skipping
    devDependencies and every workspace package, for the release job below,
    which runs only the Changesets CLI.
  - Move `@changesets/cli`, and every package `.changeset/config.json` loads,
    such as a changelog package, into the root's `dependencies` first, with what
    those import at runtime and their peers; a private workspace root never
    publishes them.
  - Set `"format": false` in `.changeset/config.json`, or put the formatter it
    would run, such as Prettier and its plugins, in the root's `dependencies`
    too, since Changesets formats the CHANGELOGs it writes.
  - A miss otherwise fails only the release job on the release branch, so a
    workspace can run the same install in a PR job, as jj-kit's `ci.yml` does in
    `🚀 Release install`, then `changeset version` on a fabricated changeset.
    - Give that job the same checkout as the release job, so it fails where that
      one would.
  - `version-or-release` checks that `@changesets/cli` resolves from the repo
    root, and fails naming the root's `dependencies` when it doesn't.
  - It needs `setup` 0.2.0 or later, like `cache`.
  - It needs `cache: false` too, or `setup` fails: a store saved from it would
    hold only the root's `dependencies`, and every full install would then
    restore it under the lockfile's key and never save a fuller one.
  - A single-package repo that publishes keeps the default, since its
    `dependencies` ship.
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
        with:
          cache: false

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
        with:
          cache: false
          install: root

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
- **Pass `cache: false` to `setup` in both jobs**, as the [setup](#setup)
  section says.
- **Pass `install: root` in the release job alone**, which then links only the
  Changesets CLI's tree, not the dev tools; the plan job builds, so it keeps the
  whole install.
- **Fetch the tags in the plan job's checkout**, with `fetch-tags: true`.
  - Without them, Changesets asks `git ls-remote`, which fails in a private repo
    once `persist-credentials` is off, so every private package looks untagged
    and each run tries to tag it again.
- **In a private repo, give the release job's checkout `fetch-depth: 0`.**
  - On a shallow clone, `changeset version` runs `git fetch --deepen` to find
    the commit that added each changeset, and `changesets/action` v2.1.2 gives
    that fetch no credentials, so it fails and no version PR opens.
  - A public repo's fetch needs none, so a shallow checkout works there.
- **Pass `build-script` whenever anything publishes to npm**, or `"true"` when
  nothing needs building; left empty, `pack-release` fails rather than publish
  packages without their build output.
- **Drop any manual recovery for a merge that published nothing**: the next run
  with no releasing changeset pending publishes it.
- **The repo allows GitHub Actions to create pull requests**, in Settings →
  Actions → General, and has a `🚀 release` label.
- **Its version PR's CI run waits for an approval click** each release (see
  [Which token opens the version PR](../decisions/version-pr-token.md)).
