---
type: Decision
title: How the shared tsconfigs are split
description:
  "`kit-tsconfig` ships four bases split by how code runs: `base.json` for the
  strict checks every project shares, `node.json` for code Node runs under type
  stripping, `bundler.json` for bundled code and `lib.json` for published
  packages, following the TypeScript docs' module templates."
tags:
  - bundler
  - compiler-options
  - kit-tsconfig
  - libraries
  - modules
  - node
  - type-stripping
  - typescript
sources:
  - id: ts-choosing-compiler-options
    resource: https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html
    title: "TypeScript handbook, Modules: Choosing Compiler Options"
  - id: ts-node-target-mapping
    resource: https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping
    title: TypeScript wiki, Node Target Mapping
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T23:17:48Z }
verified: { by: human:jjloneman, at: 2026-11-27T23:26:20Z }
---

# How the shared tsconfigs are split

- The owner's repos run TypeScript three ways: Node running source under type
  stripping, a bundler, and published libraries built to `dist/`.
- Each needs different module settings, while the strictness options are the
  same everywhere.

## Decision

- **As of 2026-11-27,** from `packages/tsconfig/`, as #8 built it.
- **Four bases, split by how the code runs:**
  - `base.json`: the checks every project shares, `strict`,
    `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
    `verbatimModuleSyntax`, `erasableSyntaxOnly` and `skipLibCheck`, plus
    `target` and `lib`, and no module settings;
  - `node.json`: extends `base.json`, with `module: nodenext`,
    `allowImportingTsExtensions`, `noEmit` and `types: ["node"]`, for code Node
    runs directly under type stripping;
  - `bundler.json`: extends `base.json`, with `module: esnext`,
    `moduleResolution: bundler`, `esModuleInterop`, `allowImportingTsExtensions`
    and `noEmit`, for code a bundler builds;
  - `lib.json`: extends `base.json`, with `module: nodenext`, `declaration`,
    `isolatedDeclarations` and `types: ["node"]`, for published packages tsdown
    builds.
- **They follow the TypeScript handbook's "Choosing Compiler Options"
  page**[^ts-choosing-compiler-options], checked on 2026-11-27, which gives one
  template for a bundler app, one for an app Node runs, and one for a library.
- **`bundler.json` uses the handbook's `module: esnext`**, with the options its
  template marks required or recommended, other than `customConditions`, which
  names a project's own export conditions, and `allowArbitraryExtensions`, which
  only a project that imports non-code files needs.
  - Its `esModuleInterop` is already TypeScript 6's default, and is set only to
    match the template; turning it off is an error (TS5107) unless
    `ignoreDeprecations` is `"6.0"`, and stops working in TypeScript 7.0.
  - `lib` stays `es2025` alone, so a web app adds `"dom"`, which in TypeScript 6
    includes the iterable DOM types.
  - **Rejected: `module: preserve`**, which #8 first planned: it leaves each
    import as written and implies `esModuleInterop`, but the owner chose the
    handbook's value at #8's plan review, so each base still diffs against the
    page.
- **`target` and `lib` are `es2025`**, for Node 26.
  - The TypeScript wiki's Node Target Mapping[^ts-node-target-mapping], checked
    on 2026-11-27, stops at Node 24, with `ES2024`.
  - Node 26.13.1 runs every ES2025 addition checked, and TypeScript 6.0.3 ships
    `lib.es2025.d.ts`.
- **`node.json` and `lib.json` use `module: nodenext`**, not the wiki's
  suggested `node20`, which fixes Node 20's behavior and implies `es2023`; the
  kit supports Node 26 only (see [Node 26 only](node-26-only.md)).
- **`allowImportingTsExtensions` works under `nodenext`** with `noEmit`, checked
  with TypeScript 6.0.3; without `noEmit`, `emitDeclarationOnly` or
  `rewriteRelativeImportExtensions`, tsc refuses it (TS5096).
- **No paths in the shared files:** `include`, `outDir` and `rootDir` stay in
  each consumer's own `tsconfig.json`, since `extends` resolves them relative to
  the file that sets them.
  - TypeScript 6 also reports TS5011 when `outDir` is set without `rootDir`, so
    a `lib.json` consumer that builds with tsc sets both.
- **`noEmit` stays out of `base.json`**, so `lib.json` can emit declarations.
  - A `lib.json` package that tsdown builds sets `noEmit` itself, unless it also
    extends `node.json`, or a plain `tsc` typecheck writes `.js` and `.d.ts`
    files beside its sources.
- **`lib.json` leaves out the library template's `sourceMap` and
  `declarationMap`**, so each package picks its own maps: tsc emits them only
  where it builds, and tsdown's declaration plugin defaults its `sourcemap` to
  `declarationMap`, so a tsdown package sets `declarationMap` or tsdown's
  `dts.sourcemap`.
- **`node.json` and `lib.json` need `"type": "module"`** in the consumer's
  `package.json`: under `nodenext`, `verbatimModuleSyntax` rejects importing or
  exporting a value in a CommonJS file (TS1295, TS1287).
- **The package ships JSON only**, with `typescript` `^6.0.0` as a peer
  dependency and `@types/node`, unpinned, as an optional one.
  - The root catalog's `<6.1` cap on TypeScript is typescript-eslint's, so it
    stays out of this package's range.
- **jj-kit's own configs extend `lib.json` and `node.json`**, which set no
  option to conflicting values, so the order doesn't matter: `lib.json` for
  `isolatedDeclarations`, which enforces the repo's declared return types, and
  `node.json` for running under Node.

## Why

- The split matches the handbook's own scenarios, so a later reader can diff
  each base against the page it came from.
- A consumer picks one base by how its code runs, and composes with an `extends`
  array when it needs two.

## Consequences

- The handbook's templates can change; a change to a base cites the page again
  with the date it was checked.
- A package whose published code supports a Node older than 26 lowers `target`
  and `lib`, and keeps `@types/node` at its own floor.
- Raising `target` and `lib` past `es2025` waits for both a Node release and a
  TypeScript lib that cover the next edition.

## Links

- #8, which builds `kit-tsconfig`.
- #3, which records this decision.

[^ts-choosing-compiler-options]:
    The handbook page's templates set `module: esnext` with
    `moduleResolution: bundler` for a bundler, `module: nodenext` for Node, and
    `module: node18` with `declaration` for a library.

[^ts-node-target-mapping]:
    The wiki maps Node 24 to `ES2024` for `target` and `lib`, with
    `module: nodenext`, and suggests `node20` once TypeScript 5.9 is out.
