# jj-kit

[![CI](https://img.shields.io/github/actions/workflow/status/jjloneman/jj-kit/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)](https://github.com/jjloneman/jj-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/jjloneman/jj-kit?color=blue)](LICENSE)
[![Node >=26](https://img.shields.io/badge/node-%3E%3D26-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm 12](https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript 6.0](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

🧰 My shared repo kit: lint, format, TypeScript, release and CI configs every
repo inherits

> 🚧 Under construction: the workspace, its tooling and the release pipeline are
> in place, and the packages are on their way.

- **The problem:** every one of my repos used to copy the same ESLint, Prettier,
  TypeScript, git hook, changelog and CI setup, and the copies drifted.
- **jj-kit is the one home for all of it:** each piece ships as an npm package
  under `@jjloneman/kit-*` or as a composite GitHub Action.
- **Each piece is versioned on its own**, so a fix lands once and Renovate
  carries it everywhere.

## 📖 Table of contents

- [📦 Packages](#-packages)
  - [kit-changesets-changelog](#kit-changesets-changelog)
  - [kit-eslint-config](#kit-eslint-config)
  - [kit-eslint-plugin](#kit-eslint-plugin)
  - [kit-prettier-config](#kit-prettier-config)
  - [kit-tsconfig](#kit-tsconfig)
  - [kit-git-hooks](#kit-git-hooks)
- [🎬 Actions](#-actions)
  - [require-changeset](#require-changeset)
  - [pack-release](#pack-release)
  - [version-or-release](#version-or-release)
  - [setup](#setup)
- [📚 Design decisions](#-design-decisions)
- [🛠️ Contributing](#️-contributing)

## 📦 Packages

- Each package is published to npm under `@jjloneman/`, with its own version and
  `CHANGELOG.md`.
- [Consuming the kit](docs/references/consuming.md) shows how to install and
  wire each one.

### kit-changesets-changelog

- A Changesets changelog formatter that prefixes each line with the gitmoji and
  scope of the commit that added the changeset, which after a squash merge is
  the PR title.
- Its [README](packages/changesets-changelog/README.md) has the line format, the
  config line and a sample changelog.

### kit-eslint-config

- 🚧 Coming in #10: a typed `defineConfig(options)` for flat-config ESLint, with
  typed linting, sorted keys and the kit's own rules.

### kit-eslint-plugin

- 🚧 Coming in #9: the kit's own ESLint rules, starting with
  `no-dotted-jsdoc-param`.

### kit-prettier-config

- 🚧 Coming in #7: a base Prettier config, and a variant for zsh scripts.

### kit-tsconfig

- Shared `tsconfig` bases, split by how the code runs, which jj-kit's own
  configs extend:

| File           | Extend it for                                               |
| -------------- | ----------------------------------------------------------- |
| `node.json`    | Scripts, configs and actions Node runs under type stripping |
| `bundler.json` | Apps a bundler builds                                       |
| `lib.json`     | Published libraries, built to `dist/`                       |
| `base.json`    | Only the strict checks, with no module settings             |

- Its [README](packages/tsconfig/README.md) has what each sets and how to
  compose two.

### kit-git-hooks

- 🚧 Coming in #11: `kit-pre-commit` and `kit-pre-push` commands, so each repo's
  hook is one line.

## 🎬 Actions

- Composite actions, referenced as `jjloneman/jj-kit/actions/<name>`.
- Each has its own version, `CHANGELOG.md` and `<name>@<version>` tag.
- `require-changeset` and `pack-release` share code from `actions/lib`, which
  isn't an action; a release of it releases both.
- **Pin each by full commit SHA, with its tag in a comment:**

  ```yaml
  - uses: jjloneman/jj-kit/actions/require-changeset@<sha> # require-changeset@<version>
  ```

- **Let Renovate update the pins** by extending the kit's preset,
  `github>jjloneman/jj-kit//renovate/actions`, since Renovate's built-in
  `github-actions` manager can't read them.
- **Run `setup` first**, after checking out the repo, so the others find pnpm,
  Node 26 and the workspace installed.
  - It installs only what the repo's lockfile lists, so the repo itself depends
    on `@changesets/cli` 3 or later, in its root's `dependencies` when the
    release job passes `install: root`.
- [Consuming the kit](docs/references/consuming.md) shows how to wire each one.

### require-changeset

- Fails a PR that adds or edits no changeset, judged by
  `changeset status --output`, so an empty changeset passes.
- **Skips, for a PR from the repo itself, never a fork:**
  - the version PR, `changeset-release/<base>` from a `version-pr-authors`
    login;
  - a branch matching `skip-branches`;
  - a Renovate PR that changes no versioned package's `dependencies`,
    `optionalDependencies`, `peerDependencies` or `engines`, `catalog:` entries
    included, and no other file a package ships.
- **A Renovate PR that does change them** needs a changeset that releases each
  package it ships.
  - Versioned is Changesets' own rule: a package with a name and version, not in
    the config's `ignore`, and public, or private while
    `privatePackages.version` is on.
  - A package ships a change when its dependencies, `engines`, entry points or
    `files` change, or a file it publishes changes: one
    `pnpm pack --dry-run --ignore-scripts --ignore-pnpmfile` lists in its
    folder.
  - Any other file in a versioned package, such as a build config or a file the
    PR deletes, needs a changeset, an empty one included.
  - In a single-package repo, the root is judged the same way.
- **Needs** a `pull_request` event, `contents: read`, a checkout with
  `fetch-depth: 0`, a Linux or macOS runner, and, for Renovate PRs, pnpm 10.26
  or later and `yq` v4, which GitHub's Ubuntu runners ship.

| Input                | Default               | What it does                                                                       |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `base`               | `github.base_ref`     | The branch to diff against, as `origin/<base>`                                     |
| `renovate-authors`   | `renovate[bot]`       | Newline-separated logins whose PRs from `renovate-branches` take the Renovate path |
| `renovate-branches`  | `renovate/**`         | Newline-separated globs of Renovate's branches, matching its `branchPrefix`        |
| `skip-branches`      | none                  | Newline-separated globs of head branches that skip the check                       |
| `version-pr-authors` | `github-actions[bot]` | Newline-separated logins whose `changeset-release/<base>` PR is the version PR     |

### pack-release

- Decides what a release run does, in a job **without write access**, since the
  build runs every dev dependency's code:
  - `version` while a releasing changeset is pending;
  - `publish` when `changeset publish-plan` lists a version npm or the git tags
    lack, even with empty changesets pending;
  - `none` when the plan is empty, so a docs-only merge builds nothing.
- **Holds back each version at `0.0.0`**, and each package that depends on one,
  with a notice naming them, so nothing is published or tagged before its first
  version PR; the rest still publish.
- **When publishing**, runs `build-script` if anything goes to npm, then uploads
  the checked plan and packs and uploads the release through
  `changesets/action/pack`.
  - It fails when something goes to npm and `build-script` is empty, rather than
    publish packages without their build output.
- **Needs** a job with no write permissions, a Linux or macOS runner, and
  `@changesets/cli` 3 or later.
- **Pass `cache: false` to `setup` in its job**, since it builds what's
  published (see [setup](#setup)).

| Input          | Default                            | What it does                                                                  |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `build-script` | none, which fails a publish to npm | The command that builds before packing, or `true` when nothing needs building |

- **Outputs** `next`, and `pack-dir-artifact-id` when publishing, for
  `version-or-release`.

### version-or-release

- Runs in the job after `pack-release`'s, only while its `next` isn't `none`:
  - `version` keeps the rolling version PR open through
    `changesets/action/version`, then labels and assigns it;
  - `publish` publishes the uploaded pack through `changesets/action/publish`,
    which also pushes the tags and creates the GitHub releases, and never reads
    the pending changesets, so empty ones left on `main` don't stop it.
- **Needs** a push to the release branch, `contents: write`,
  `pull-requests: write`, `id-token: write` for npm trusted publishing, and the
  label in the repo.
- **It checks first that `@changesets/cli` resolves from the repo root**, as
  Changesets' sub-actions resolve it, and fails naming `install: root` and the
  root's `dependencies` when it doesn't.
- **Pass `cache: false` to `setup` in its job**, which holds those permissions
  (see [setup](#setup)).
- **In a workspace, pass `install: root` too**, so the job installs only the
  root's `dependencies`.
  - Those must hold `@changesets/cli` 3 or later, every package
    `.changeset/config.json` loads, with what those import at runtime and their
    peers, and, unless the config sets `"format": false`, the formatter
    Changesets runs.
  - A single-package repo that publishes keeps the default, since its
    `dependencies` ship.
- With `GITHUB_TOKEN`, the repo turns on "Allow GitHub Actions to create and
  approve pull requests", and the version PR's CI run waits for an approval
  click (see
  [Which token opens the version PR](docs/decisions/version-pr-token.md)).

| Input                  | Default                               | What it does                                    |
| ---------------------- | ------------------------------------- | ----------------------------------------------- |
| `assignee`             | none                                  | The login to assign the version PR to           |
| `commit-message`       | `chore(release): 🚀 version packages` | The version PR's commit message                 |
| `github-token`         | required                              | The token that opens the PR and pushes tags     |
| `label`                | `🚀 release`                          | The label to add to the version PR              |
| `next`                 | required                              | `pack-release`'s `next`: `version` or `publish` |
| `pack-dir-artifact-id` | none                                  | `pack-release`'s artifact id, for `publish`     |
| `pr-title`             | `chore(release): 🚀 version packages` | The version PR's title                          |

- **Outputs** `pr-number`, `published` and `published-packages`, passed through
  from `changesets/action`'s sub-actions.

### setup

- Installs pnpm, Node and the frozen-lockfile dependency tree: the prelude every
  CI job that runs a pnpm script shares.
- **pnpm's version comes from `packageManager`** in the root `package.json`, and
  its store is cached unless `cache` is `false`; the install still links
  `node_modules` from it.
- **Pass `cache: false` in a job with write permissions or `id-token: write`, or
  one that builds what's published**, such as both release jobs, so it never
  installs from a store another job saved.
  - It needs `setup` 0.2.0 or later; an older pin only warns about the unknown
    input and keeps the cache on.
  - A job that can request an OIDC token gets a warning while the cache is on.
- **Pass `install: root` in a job that runs only what the root's `dependencies`
  hold**, such as the job that versions or publishes, so it skips
  devDependencies and every workspace package.
  - It needs `setup` 0.2.0 or later; an older pin only warns about the unknown
    input and installs the whole workspace.
  - It needs `cache: false` too, or `setup` fails, since a store saved from it
    would hold only the root's `dependencies`.
- **Keep any extra setup**, such as a browser install, as a local step after
  this one.

  ```yaml
  - uses: actions/checkout@<sha> # v7.0.1
    with:
      persist-credentials: false

  - uses: jjloneman/jj-kit/actions/setup@<sha> # setup@<version>
  ```

| Input          | Default  | What it does                                                                          |
| -------------- | -------- | ------------------------------------------------------------------------------------- |
| `cache`        | `"true"` | Whether to restore and save the pnpm store cache; `false` in either release job       |
| `install`      | `all`    | `all` installs the whole workspace; `root`, only the root's `dependencies`            |
| `node-version` | `"26"`   | The Node to install; pass an older one only for a job that tests published code on it |

## 📚 Design decisions

- **Why the kit works the way it does** is in
  [docs/decisions/](docs/decisions/index.md), one record per decision.
- **How it's built and consumed** is in
  [docs/references/](docs/references/index.md):
  - [Architecture](docs/references/architecture.md);
  - [Consuming the kit](docs/references/consuming.md).
- Both are
  [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
  bundles: agents draft each record, and the owner signs it off with
  [okf-tools](https://github.com/jjloneman/okf-tools).

## 🛠️ Contributing

- Node 26 and pnpm 12 are required.
- [AGENTS.md](AGENTS.md) holds the full conventions.

```sh
pnpm install
pnpm check
```

- **`pnpm check` runs every gate CI requires except `🦋 Changeset`:**
  - it fixes lint and formatting;
  - then runs the typecheck, the tests with coverage and the package checks.
- **Every PR adds or edits a changeset**, and CI's `🦋 Changeset` job fails a PR
  without one:
  - `pnpm changeset` for a change a package ships;
  - `pnpm changeset --empty` for one that releases nothing.
- Each package lives in `packages/<name>` with its own `package.json` and
  `tsconfig.json`, and each action in `actions/<name>` with a private
  `package.json`.
- Shared dev dependency versions live in `pnpm-workspace.yaml`'s `catalog`;
  reference them as `catalog:`.
- **A package that builds code has its own `tsdown.config.ts`.**
  - It defines a `lint:package` script,
    `pnpm build && publint && attw --pack --profile esm-only`, which CI's
    `📦 Package` job runs.
  - A JSON-only package, such as `kit-tsconfig`, has no build config, and its
    `lint:package` runs publint alone.
- Tests run as one Vitest workspace from the root, with a 100% coverage gate
  over `actions/*/src` and `packages/*/src`.
- JSON keys, `package.json` included, stay alphabetized at every level;
  `pnpm lint:fix` sorts them.
- Merging the rolling `chore(release): 🚀 version packages` PR publishes each
  bumped package and tags it, and each bumped action, `<name>@<version>`.
