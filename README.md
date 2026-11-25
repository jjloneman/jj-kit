# jj-kit

[![CI](https://img.shields.io/github/actions/workflow/status/jjloneman/jj-kit/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)](https://github.com/jjloneman/jj-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/jjloneman/jj-kit?color=blue)](LICENSE)
[![Node >=26](https://img.shields.io/badge/node-%3E%3D26-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm 12](https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript 6.0](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

🧰 My shared repo kit: lint, format, TypeScript, release and CI configs every repo inherits

> 🚧 Under construction: the workspace, its tooling and the release pipeline are in place, and the packages are on their way.

- **The problem:** every one of my repos used to copy the same ESLint, Prettier, TypeScript, git hook, changelog and CI setup, and the copies drifted.
- **jj-kit is the one home for all of it:** each piece ships as an npm package under `@jjloneman/kit-*` or as a composite GitHub Action.
- **Each piece is versioned on its own**, so a fix lands once and Renovate carries it everywhere.

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
- [🛠️ Contributing](#️-contributing)

## 📦 Packages

- Each package is published to npm under `@jjloneman/`, with its own version and `CHANGELOG.md`.

### kit-changesets-changelog

- 🚧 Coming in #4: a Changesets changelog formatter that prefixes each line with the gitmoji and scope of the squash commit that added it.

### kit-eslint-config

- 🚧 Coming in #10: a typed `defineConfig(options)` for flat-config ESLint, with typed linting, sorted keys and the kit's own rules.

### kit-eslint-plugin

- 🚧 Coming in #9: the kit's own ESLint rules, starting with `no-dotted-jsdoc-param`.

### kit-prettier-config

- 🚧 Coming in #7: a base Prettier config, and a variant for zsh scripts.

### kit-tsconfig

- 🚧 Coming in #8: `base.json`, `node.json`, `bundler.json` and `lib.json`, split by how the code runs.

### kit-git-hooks

- 🚧 Coming in #11: `kit-pre-commit` and `kit-pre-push` commands, so each repo's hook is one line.

## 🎬 Actions

- Composite actions, referenced as `jjloneman/jj-kit/actions/<name>`.

### require-changeset

- 🚧 Coming in #5: fails a PR that adds no changeset.

### version-or-release

- 🚧 Coming in #5: opens the rolling version PR, or publishes once it merges, then labels and assigns the version PR.

### setup

- 🚧 Coming in #6: installs pnpm and Node, then the frozen-lockfile dependency tree.

## 🛠️ Contributing

- Node 26 and pnpm 12 are required.
- [AGENTS.md](AGENTS.md) holds the full conventions.

```sh
pnpm install
pnpm check
```

- **`pnpm check` runs the same gates CI requires:**
  - it fixes lint and formatting;
  - then runs the typecheck, the tests with coverage and the package checks.
- **Every PR adds or edits a changeset**, and CI's `🦋 Changeset` job fails a PR without one:
  - `pnpm changeset` for a change a package ships;
  - `pnpm changeset --empty` for one that releases nothing.
  - Until the first package lands, write the empty one by hand, as [.changeset/README.md](.changeset/README.md) says.
- Each package lives in `packages/<name>` with its own `package.json` and `tsconfig.json`.
- Shared dev dependency versions live in `pnpm-workspace.yaml`'s `catalog`; reference them as `catalog:`.
- **A published package builds with its own `tsdown.config.ts`.**
  - It defines a `lint:package` script, `pnpm build && publint && attw --pack --profile esm-only`, which CI's `📦 Package` job runs.
- Tests run as one Vitest workspace from the root, with a 100% coverage gate over `packages/*/src`.
- JSON keys, `package.json` included, stay alphabetized at every level; `pnpm lint:fix` sorts them.
- Merging the rolling `chore(release): 🚀 version packages` PR publishes each bumped package and tags it `<name>@<version>`.
