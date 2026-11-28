---
type: Reference
title: The tsconfig bases, option by option
description:
  Every option `kit-tsconfig`'s four bases set, in the order each file sets it,
  with why it's there, and what each base leaves out on purpose.
tags:
  - consumers
  - kit-tsconfig
  - node
  - type-stripping
sources:
  - id: ts-choosing-compiler-options
    resource: https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html
    title: "TypeScript handbook, Modules: Choosing Compiler Options"
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-28T03:52:19Z }
verified: { by: human:jjloneman, at: 2026-11-28T04:15:44Z }
---

# The tsconfig bases, option by option

- **As of 2026-11-28,** from `packages/tsconfig/`, checked with TypeScript
  6.0.3.
- Read the bases in this order: `base.json` first, since the other three extend
  it, then `node.json`, `bundler.json` and `lib.json`.
- Within each base, options are listed in the file's own order, which is
  alphabetical.
- Why the bases are split this way is in
  [How the shared tsconfigs are split](../decisions/tsconfig-split.md); how a
  repo installs and extends them is in
  [Consuming the kit](consuming.md#kit-tsconfig).
- The handbook's "Choosing Compiler Options" page[^ts-choosing-compiler-options]
  is cited below as "the handbook".

## `base.json`: the checks every project shares

- **`erasableSyntaxOnly: true`**
  - Bans syntax that emits code, such as an `enum`, a namespace with values or a
    constructor parameter property.
  - Why: Node's type stripping only deletes types, so code that needs emitting
    fails at runtime; setting it in every base keeps all the owner's code
    strippable, bundled or not.
- **`exactOptionalPropertyTypes: true`**
  - An optional property rejects an explicit `undefined` unless its type names
    `undefined`.
  - Why: a missing key and a key set to `undefined` behave differently under
    `in`, `Object.keys` and spreads, and `strict` doesn't tell them apart.
- **`lib: ["es2025"]`**
  - Why: Node 26 runs all of ES2025, and TypeScript 6 ships `lib.es2025.d.ts`.
  - No `dom`: most of the owner's code runs in Node, so a web app adds `"dom"`
    itself.
  - Set together with `target`; a project for an older runtime lowers both.
- **`noUncheckedIndexedAccess: true`**
  - `array[i]` and `record[key]` include `undefined` in their type.
  - Why: an index can always miss, and `strict` alone types it as always
    present.
- **`skipLibCheck: true`**
  - Skips checking `.d.ts` files, such as those in `node_modules`.
  - Why: errors in a dependency's types aren't the project's to fix, and
    checking them slows every run.
  - The handbook doesn't mention it.
- **`strict: true`**
  - Already TypeScript 6's default.
  - Why set: so the base says so, as the handbook's library template does and
    its other templates tell a reader to.
- **`target: "es2025"`**
  - Why: matches `lib`, so emitted code uses what Node 26 runs, with nothing
    downleveled.
  - The handbook's library template says to set the _lowest_ target supported,
    so a package for an older Node lowers it.
- **`verbatimModuleSyntax: true`**
  - A type-only import must say `import type`, and every other import is emitted
    exactly as written.
  - Why: Node's type stripping removes only `import type`, so an untagged type
    import would reach Node and fail with a `SyntaxError`; the handbook sets it
    in all three templates.
- **Left out on purpose:**
  - `module` and `moduleResolution`, which each child base sets by how its code
    runs;
  - `noEmit`, so `lib.json` can emit declarations;
  - `include`, `outDir` and `rootDir`, which resolve against the file that sets
    them, so they belong in the consumer's own config.

## `node.json`: code Node runs under type stripping

- Extends `base.json`; nothing is emitted.
- **`allowImportingTsExtensions: true`**
  - A relative import names the `.ts` file, such as `./util.ts`.
  - Why: Node's type stripping loads the real file name and rewrites nothing, so
    `./util.js` wouldn't be found.
  - tsc allows it only with `noEmit`, `emitDeclarationOnly` or
    `rewriteRelativeImportExtensions` (TS5096); this base sets `noEmit`.
- **`module: "nodenext"`**
  - Resolves and checks imports as Node does: `package.json` `exports`, required
    file extensions, and ESM or CommonJS by the nearest `package.json`'s `type`.
  - Why: the handbook's Node template requires it; `node20` would fix Node 20's
    behavior and imply `es2023`, and the kit supports Node 26 only.
  - It needs `"type": "module"` in the project's `package.json`, since
    `verbatimModuleSyntax` rejects importing or exporting a value in a CommonJS
    file (TS1295, TS1287).
- **`noEmit: true`**
  - Why: Node runs the source as it is, so tsc only typechecks.
- **`types: ["node"]`**
  - Why: TypeScript 6 loads no `@types` by default, so Node's are named.
  - The consumer's own `@types/node` version sets the floor, so the typecheck
    rejects an API its oldest supported Node lacks.

## `bundler.json`: code a bundler builds

- Extends `base.json`, following the handbook's bundler template; the bundler
  emits.
- **`allowImportingTsExtensions: true`**
  - Why: a bundler resolves `.ts` imports itself; the handbook recommends it.
- **`esModuleInterop: true`**
  - Already TypeScript 6's default; the handbook's template requires it.
  - Why set: so the base diffs cleanly against the template; turning it off is
    an error (TS5107) unless `ignoreDeprecations` is `"6.0"`, and stops working
    in 7.0.
- **`module: "esnext"`**
  - Why: the handbook's template requires it; `preserve` was planned first, and
    the owner chose the handbook's value at #8's plan review.
- **`moduleResolution: "bundler"`**
  - Resolves `package.json` `exports` like Node, but needs no file extension.
  - Why: that's how bundlers resolve; the handbook requires it.
- **`noEmit: true`**
  - Why: the bundler writes the JavaScript, so tsc only typechecks; the handbook
    recommends it.
- **Left out on purpose:**
  - `types`, so no `@types` load; a project that runs in Node or a test runner
    names its own;
  - `"dom"` in `lib`, which a web app adds as `["es2025", "dom"]`;
  - the template's `customConditions`, which names a project's own export
    conditions, and `allowArbitraryExtensions`, which only a project that
    imports non-code files needs.

## `lib.json`: a published package

- Extends `base.json`; built to `dist/` by tsdown or tsc.
- **`declaration: true`**
  - Why: consumers get types only from emitted `.d.ts` files, and
    `isolatedDeclarations` requires it.
- **`isolatedDeclarations: true`**
  - Every export declares types a declaration emitter can read without the
    checker, such as a function's return type.
  - Why: the published `.d.ts` never depends on inference, and tsdown's
    declaration plugin, `rolldown-plugin-dts`, picks its faster `oxc` generator
    when it's on.
  - It also enforces the owner's rule that exported functions declare their
    return type, which no ESLint rule does.
- **`module: "nodenext"`**
  - Why: checks imports as Node will resolve them, whether tsc or tsdown writes
    `dist/`; the same reason as `node.json`, and the handbook's library template
    uses `node18` for the same end.
  - It needs `"type": "module"`, as in `node.json`.
- **`types: ["node"]`**
  - Why: the same as `node.json`; a package's `@types/node` stays at the oldest
    Node it supports.
- **Left out on purpose:**
  - `noEmit`, so tsc can emit; a package tsdown builds sets it, unless it also
    extends `node.json`;
  - `outDir` and `rootDir`, which a package that emits with tsc sets itself,
    since TypeScript 6 reports TS5011 for `outDir` without `rootDir`;
  - the template's `sourceMap` and `declarationMap`: tsc emits them only where
    it builds, and tsdown's declaration plugin defaults its `sourcemap` to
    `declarationMap`, so each package picks its own.

## Composing two

- jj-kit's own configs extend `["…/lib.json", "…/node.json"]`: `lib.json` for
  `isolatedDeclarations`, `node.json` for `.ts` imports and `noEmit`.
- The two set no option to different values, so their order doesn't change the
  result.

[^ts-choosing-compiler-options]:
    Checked on 2026-11-28; the page has a bundler template, a Node template and
    a library template, and doesn't mention `skipLibCheck` or `types`.
