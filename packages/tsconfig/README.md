# @jjloneman/kit-tsconfig

- Shared `tsconfig` bases, split by how the code runs, following the TypeScript
  handbook's
  [Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)
  templates.
- Part of [jj-kit](https://github.com/jjloneman/jj-kit), my shared repo kit.

## 📦 Install

- TypeScript 6, and `@types/node` for `node.json` and `lib.json`.

```sh
pnpm add --save-dev --save-exact @jjloneman/kit-tsconfig
```

## 🧩 Bases

| File           | For                                                           | Module settings                    |
| -------------- | ------------------------------------------------------------- | ---------------------------------- |
| `base.json`    | The strict checks every project shares; the others extend it  | none                               |
| `node.json`    | Code Node runs directly under type stripping, such as scripts | `nodenext`, `.ts` imports, no emit |
| `bundler.json` | Code a bundler builds, such as a web app                      | `esnext` with `bundler`, no emit   |
| `lib.json`     | A published package, built to `dist/` by tsdown or tsc        | `nodenext`, `isolatedDeclarations` |

- **`base.json`** sets `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly` and
  `skipLibCheck`, with `target` and `lib` at `es2025` for Node 26.
- **`node.json` and `lib.json` load Node's types**, since TypeScript 6 loads
  none by default; `bundler.json` loads none.
- **Why each option is set** is in
  [The tsconfig bases, option by option](https://github.com/jjloneman/jj-kit/blob/main/docs/references/tsconfig-options.md).

## 🔧 Use

- Extend the base that fits, and keep the paths in your own config, since
  `include`, `outDir` and `rootDir` resolve against the file that sets them:

```json
{
  "extends": "@jjloneman/kit-tsconfig/node.json",
  "include": ["src", "*.config.ts"]
}
```

- Then delete the options the base already sets, keeping only your repo's own.
- **Compose two with an `extends` array**, later ones winning, such as a package
  whose source Node also runs directly:

```json
{
  "extends": [
    "@jjloneman/kit-tsconfig/lib.json",
    "@jjloneman/kit-tsconfig/node.json"
  ],
  "include": ["src"]
}
```

- **`node.json` and `lib.json` need `"type": "module"`** in the project's
  `package.json`: under `nodenext`, `verbatimModuleSyntax` rejects importing or
  exporting a value in a CommonJS file (TS1295, TS1287).
- **A `lib.json` package that tsdown builds sets `noEmit: true`**, unless it
  also extends `node.json`, or a plain `tsc` typecheck writes `.js` and `.d.ts`
  files beside its sources.
- **A `lib.json` package that emits with tsc sets `outDir` and `rootDir`**;
  TypeScript 6 reports TS5011 when `outDir` is set without `rootDir`.
- **A web app on `bundler.json` adds `"dom"` to `lib`**, as `["es2025", "dom"]`;
  TypeScript 6's `dom` includes the iterable DOM types.
- **A package that supports a Node older than 26** lowers `target` and `lib` to
  match, and keeps `@types/node` at its own floor; no base pins one.
