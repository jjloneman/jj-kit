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

- 🚧 Coming in #8: `base.json`, `node.json`, `bundler.json` and `lib.json`,
  split by how the code runs.

### kit-git-hooks

- 🚧 Coming in #11: `kit-pre-commit` and `kit-pre-push` commands, so each repo's
  hook is one line.

## 🎬 Actions

- Composite actions, referenced as `jjloneman/jj-kit/actions/<name>`.
- Each has its own version, `CHANGELOG.md` and `<name>@<version>` tag.
- They share code from `actions/lib`, which isn't an action; a release of it
  releases both actions.
- **Pin each by full commit SHA, with its tag in a comment:**

  ```yaml
  - uses: jjloneman/jj-kit/actions/require-changeset@<sha> # require-changeset@<version>
  ```

- **Run them after your own setup step**, which checks out the repo and installs
  pnpm, Node 26 and the workspace, `@changesets/cli` 3 or later included.
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
    `files` change, or a file it publishes changes: one its `files` list
    includes, a README or license, or its `main` or `bin` target, or any file
    when it has no `files` list.
  - Any other file in a versioned package, such as a build config, needs a
    changeset, an empty one included.
  - In a single-package repo, the root is judged the same way.
- **Needs** a `pull_request` event, `contents: read`, a checkout with
  `fetch-depth: 0`, a Linux or macOS runner, and `yq` v4 for Renovate PRs, which
  GitHub's Ubuntu runners ship.

| Input                | Default               | What it does                                                                       |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `base`               | `github.base_ref`     | The branch to diff against, as `origin/<base>`                                     |
| `renovate-authors`   | `renovate[bot]`       | Newline-separated logins whose PRs from `renovate-branches` take the Renovate path |
| `renovate-branches`  | `renovate/**`         | Newline-separated globs of Renovate's branches, matching its `branchPrefix`        |
| `skip-branches`      | none                  | Newline-separated globs of head branches that skip the check                       |
| `version-pr-authors` | `github-actions[bot]` | Newline-separated logins whose `changeset-release/<base>` PR is the version PR     |

### version-or-release

- Wraps `changesets/action`: keeps the rolling version PR open while changesets
  are pending, then labels and assigns it.
- **Publishes whenever no releasing changeset is pending**, so a version PR's
  merge still publishes with an empty changeset left on `main`.
  - It waits while a package it would release is still at `0.0.0`, so nothing is
    published or tagged at `0.0.0`.
- **Needs** a push to the release branch, `contents: write`,
  `pull-requests: write`, `id-token: write` for npm trusted publishing, a Linux
  or macOS runner, and the label in the repo.
- With `GITHUB_TOKEN`, the repo turns on "Allow GitHub Actions to create and
  approve pull requests", and the version PR's CI run waits for an approval
  click (see
  [Which token opens the version PR](docs/decisions/version-pr-token.md)).

| Input            | Default                               | What it does                                |
| ---------------- | ------------------------------------- | ------------------------------------------- |
| `assignee`       | none                                  | The login to assign the version PR to       |
| `commit-message` | `chore(release): 🚀 version packages` | The version PR's commit message             |
| `github-token`   | required                              | The token that opens the PR and pushes tags |
| `label`          | `🚀 release`                          | The label to add to the version PR          |
| `pr-title`       | `chore(release): 🚀 version packages` | The version PR's title                      |
| `publish-script` | none, which never publishes           | The command that builds and publishes       |

- **Outputs** `pr-number`, `published` and `published-packages`, passed through
  from `changesets/action`.

### setup

- 🚧 Coming in #6: installs pnpm and Node, then the frozen-lockfile dependency
  tree.

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
    `lint:package` runs publint alone (#8).
- Tests run as one Vitest workspace from the root, with a 100% coverage gate
  over `actions/*/src` and `packages/*/src`.
- JSON keys, `package.json` included, stay alphabetized at every level;
  `pnpm lint:fix` sorts them.
- Merging the rolling `chore(release): 🚀 version packages` PR publishes each
  bumped package and tags it, and each bumped action, `<name>@<version>`.
