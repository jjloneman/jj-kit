---
type: Decision
title: How the shared tsconfigs are split
description: "`kit-tsconfig` ships four bases split by how code runs: `base.json` for the strict checks every project shares, `node.json` for code Node runs under type stripping, `bundler.json` for bundled code and `lib.json` for published packages, following the TypeScript docs' module templates."
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
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T17:54:10Z }
---

# How the shared tsconfigs are split

- The owner's repos run TypeScript three ways: Node running source under type stripping, a bundler, and published libraries built to `dist/`.
- Each needs different module settings, while the strictness options are the same everywhere.

## Decision

- **As of 2026-11-25,** as #8 plans it; `kit-tsconfig` isn't built yet.
- **Four bases, split by how the code runs:**
  - `base.json`: the checks every project shares, such as `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and `erasableSyntaxOnly`, and no module settings;
  - `node.json`: extends `base.json`, with `module: nodenext`, `allowImportingTsExtensions` and `noEmit`, for code Node runs directly under type stripping;
  - `bundler.json`: extends `base.json`, with `module: preserve`, `moduleResolution: bundler` and `noEmit`, for code a bundler builds;
  - `lib.json`: extends `base.json`, with Node resolution, `declaration` and `isolatedDeclarations`, for published packages tsdown builds.
- **They follow the TypeScript handbook's "Choosing Compiler Options" page**[^ts-choosing-compiler-options], checked on 2026-11-25, which gives one template for a bundler app, one for an app Node runs, and one for a library.
- **`bundler.json` uses `module: preserve`, not the handbook's `esnext`,** as #8 plans: `preserve` leaves each import as written for the bundler, and implies `esModuleInterop`.
  - #8 confirms it, or switches to `esnext`, when it builds the package, and updates this record.
- **No paths in the shared files:** `include`, `outDir` and `rootDir` stay in each consumer's own `tsconfig.json`, since `extends` resolves them relative to the file that sets them.
- **`noEmit` stays out of `base.json`**, so `lib.json` can emit declarations.
- **The package ships JSON only**, with `typescript` as a peer dependency.

## Why

- The split matches the handbook's own scenarios, so a later reader can diff each base against the page it came from.
- A consumer picks one base by how its code runs, and composes with an `extends` array when it needs two.

## Consequences

- The handbook's templates can change; a change to a base cites the page again with the date it was checked.
- Options #8 left unchecked, such as `allowImportingTsExtensions` under `nodenext`, and `target` and `lib` for Node 26, are settled when #8 is built, and this record is updated in that PR.
- jj-kit's own root `tsconfig.json` is a copy from okf-tools until #8 replaces it with `node.json`.

## Links

- #8, which builds `kit-tsconfig`.
- #3, which records this decision.

[^ts-choosing-compiler-options]: The handbook page's templates set `module: esnext` with `moduleResolution: bundler` for a bundler, `module: nodenext` for Node, and `module: node18` with `declaration` for a library.
