# jj-kit

🧰 My shared repo kit: lint, format, TypeScript, release and CI configs every repo inherits

> 🚧 Under construction: the workspace and its tooling are in place, and the packages are on their way.

## 📦 What's coming

- npm packages under `@jjloneman/kit-*`: ESLint, Prettier and TypeScript configs, an ESLint plugin, git hooks and a Changesets changelog formatter.
- Composite GitHub Actions for setup and releases.

## 🛠️ Contributing

Node 26 and pnpm 12 are required.

```sh
pnpm install
pnpm check
```

- Each package lives in `packages/<name>` with its own `package.json` and `tsconfig.json`.
- Shared dev dependency versions live in `pnpm-workspace.yaml`'s `catalog`; reference them as `catalog:`.
- A published package builds with its own `tsdown.config.ts`, and defines a `lint:package` script, `pnpm build && publint && attw --pack --profile esm-only`, which CI's `📦 Package` job runs.
- Tests run as one Vitest workspace from the root, with a 100% coverage gate over `packages/*/src`.
