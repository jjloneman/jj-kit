# jj-kit

[![CI](https://img.shields.io/github/actions/workflow/status/jjloneman/jj-kit/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)](https://github.com/jjloneman/jj-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/jjloneman/jj-kit?color=blue)](LICENSE)
[![Node >=26](https://img.shields.io/badge/node-%3E%3D26-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm 12](https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript 6.0](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

🧰 My shared repo kit: lint, format, TypeScript, release and CI configs every repo inherits

> 🚧 Under construction: the workspace and its tooling are in place, and the packages are on their way.

## 📖 Table of contents

- [📦 What's coming](#-whats-coming)
- [🛠️ Contributing](#️-contributing)

## 📦 What's coming

- npm packages under `@jjloneman/kit-*`: ESLint, Prettier and TypeScript configs, an ESLint plugin, git hooks and a Changesets changelog formatter.
- Composite GitHub Actions for setup and releases.

## 🛠️ Contributing

Node 26 and pnpm 12 are required.

```sh
pnpm install
pnpm check
```

- `pnpm check` fixes lint and formatting, then runs the typecheck, the tests with coverage and the package checks, the same gates CI requires.
- Each package lives in `packages/<name>` with its own `package.json` and `tsconfig.json`.
- Shared dev dependency versions live in `pnpm-workspace.yaml`'s `catalog`; reference them as `catalog:`.
- A published package builds with its own `tsdown.config.ts`, and defines a `lint:package` script, `pnpm build && publint && attw --pack --profile esm-only`, which CI's `📦 Package` job runs.
- Tests run as one Vitest workspace from the root, with a 100% coverage gate over `packages/*/src`.
- JSON keys, `package.json` included, stay alphabetized at every level; `pnpm lint:fix` sorts them.
