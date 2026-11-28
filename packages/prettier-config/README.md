# @jjloneman/kit-prettier-config

- A shared [Prettier](https://prettier.io) config, plus a variant that parses
  named files as zsh.
- Part of [jj-kit](https://github.com/jjloneman/jj-kit), my shared repo kit.

## 📦 Install

- Node 26 or later, and Prettier 3.6 or later.

```sh
pnpm add --save-dev --save-exact prettier @jjloneman/kit-prettier-config
```

- It brings `prettier-plugin-sh` and `sh-syntax` with it, so delete the repo's
  own copies.

## 🧩 What it sets

| Files                                                                         | Setting                 | Why                                                    |
| ----------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------ |
| All                                                                           | `trailingComma: "es5"`  | Trailing commas where ES5 allows them                  |
| `.githooks/!(*.*)`                                                            | `parser: "sh"`          | Git hooks have no extension for Prettier to infer from |
| Every file Prettier parses as JSONC, such as `*.jsonc` and `*.code-workspace` | `trailingComma: "none"` | Hand-edited JSONC, kept free of trailing commas        |

- **`prettier-plugin-sh` formats shell scripts**, such as `*.sh` and the hooks
  above, as bash.
- **Plain `.json` files, `tsconfig.json` included, need no override**: Prettier
  parses them with its `json` parser, which never prints trailing commas.
- **The plugins are imported modules, not names.** Prettier resolves a plugin
  name from the consumer's folder, where pnpm's strict `node_modules` can't see
  this package's own dependencies.

## 🚀 Use it

- Re-export it from `prettier.config.ts`:

  ```ts
  export { default } from "@jjloneman/kit-prettier-config";
  ```

### Add your own overrides and plugins

- **Spread the base, then add to its `OVERRIDES` and `PLUGINS`**, since setting
  `overrides` or `plugins` replaces the base's:

  ```ts
  import type { Config } from "prettier";

  import BASE, { OVERRIDES, PLUGINS } from "@jjloneman/kit-prettier-config";

  const CONFIG: Config = {
    ...BASE,
    overrides: [
      ...OVERRIDES,
      { files: "docs/**/*.md", options: { proseWrap: "always" } },
    ],
    plugins: [...PLUGINS, "prettier-plugin-toml"],
  };

  export default CONFIG;
  ```

- **A plugin you install yourself can go by name**, since it's in your own
  `node_modules`.
- **A later override wins** where two match the same file, so put yours after
  `...OVERRIDES`.
- `OVERRIDES` and `PLUGINS` are frozen, each override down to its `options`; the
  default export holds its own copies of both lists.

### Zsh scripts

- **Name the files to parse as zsh**, since the shell parser reads bash
  otherwise:

  ```ts
  import { createZshConfig } from "@jjloneman/kit-prettier-config/zsh";

  export default createZshConfig({ files: ["bin/*", "lib/*.zsh"] });
  ```

- **It returns the base plus one last override**, so it wins over the base's
  own, such as for a git hook written in zsh.
  - Spread it like the base to add more.
- **The zsh parser doesn't take every zsh construct**: as of 2026-11-28,
  `sh-syntax` 0.7.0 rejects a multi-variable `for k v in …` loop, for one.

## 🚫 Not included

- **`package.json` key order:** ESLint sorts it in the kit's repos, so this
  config leaves out `prettier-plugin-packagejson`, which would reorder it.
- **Markdown wrap:** repos wrap different folders, or none, so `proseWrap` stays
  in each repo's own overrides.
