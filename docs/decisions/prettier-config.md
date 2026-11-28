---
type: Decision
title: What the shared Prettier config holds
description:
  "`kit-prettier-config` ships the settings every copy shared, with its plugins
  as imported modules so pnpm consumers can load them, named `OVERRIDES` and
  `PLUGINS` exports to add to, and a `createZshConfig` variant; it leaves
  `package.json` order to ESLint and Markdown wrap to each repo."
tags:
  - consumers
  - dogfooding
  - formatting
  - kit-prettier-config
  - markdown
  - pnpm
  - prettier
  - shell
sources:
  - id: prettier-plugins
    resource: https://prettier.io/docs/plugins#using-plugins
    title: Prettier docs, Using Plugins
  - id: prettier-overrides
    resource: https://prettier.io/docs/configuration#configuration-overrides
    title: Prettier docs, Configuration Overrides
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-28T08:36:25Z }
---

# What the shared Prettier config holds

- The owner's repos each copied a Prettier config, and the copies had drifted:
  some added `prettier-plugin-packagejson`, some wrapped Markdown, some parsed
  scripts as zsh.
- `kit-prettier-config` replaces the copies with one package (#7).

## Decision

- **As of 2026-11-28, the base holds only what every copy shared:**
  - `trailingComma: "es5"`;
  - `prettier-plugin-sh`;
  - `parser: "sh"` for extensionless files in `.githooks/`;
  - `trailingComma: "none"` for every extension Prettier parses as JSONC, such
    as `*.jsonc` and `*.code-workspace`, checked against Prettier's
    `getSupportInfo()` by a test.
  - **Rejected: listing `tsconfig.json` and `.vscode/*.json`**, as the copies
    did: as of 2026-11-28, Prettier 3.10 parses them with `json`, which never
    prints trailing commas, so the entries did nothing.
- **Plugins are imported modules, not names**[^prettier-plugins].
  - Checked in a scratch pnpm consumer of a packed config package: the name
    `prettier-plugin-sh` failed with `Cannot find package`, since pnpm's strict
    `node_modules` doesn't expose a dependency's own dependencies; the imported
    module formatted a hook.
  - **Rejected: names plus `public-hoist-pattern`**, which would push a pnpm
    setting into every consumer.
- **`OVERRIDES` and `PLUGINS` are named exports, frozen down to each override's
  `options`**, and the default export holds its own copies with both fields
  always set.
  - Setting `overrides` or `plugins` replaces the base's, so a consumer spreads
    these to keep them.
  - **Rejected: the default export alone**, where every consumer writes
    `...(base.overrides ?? [])`, and forgetting it drops the base silently.
  - **Rejected: a `defineConfig` merge helper**, more API than a two-field
    spread needs.
- **`createZshConfig({ files })`, from `./zsh`, adds one last override**:
  `parser: "sh"` with `sh-syntax`'s `LangVariant.LangZsh`.
  - Last, since a later override wins where two match: checked by run, as
    Prettier's docs don't say[^prettier-overrides].
  - `sh-syntax` is a dependency with `^0.7.0`, `prettier-plugin-sh` 0.20.2's own
    range, not an exact pin, so a consumer's install resolves one copy.
    - An exact 0.7.0 would install a second copy once a 0.7.1 ships, since the
      plugin's range would take the newer one; the kit's zsh number would then
      come from a different copy than the parser that reads it.
    - That the package manager dedupes the two identical ranges is assumed, not
      checked: as of 2026-11-28, 0.7.0 is the only 0.7.x on npm.
    - **Rejected: an exact pin**, the repo's default, since jj-kit's lockfile
      never reaches a consumer.
    - **Rejected: importing `sh-syntax` from the plugin's own folder** with
      `createRequire`, which guarantees one copy but ties the kit to the
      plugin's layout.
  - **Rejected: hard-coding the variant's number**, since 0.7.0 types `LangZsh`
    as `number`, not a literal.
- **`package.json` key order is left to ESLint**, so the base leaves out
  `prettier-plugin-packagejson`.
  - The owner chose on 2026-11-28 that ESLint owns it, with `name`, `version`
    and `description` first, then alphabetical, as it already sorts every other
    JSON and YAML file; #10 carries that order.
  - **Rejected: the plugin in the base.** It reorders jj-kit's manifests into
    sort-package-json's grouped order, which the owner disagrees with and which
    ESLint's sort would fight.
- **Markdown `proseWrap` stays in each repo.** The copies wrapped all Markdown,
  one folder, everything, or nothing, so jj-kit keeps its own override (see
  [How Markdown is wrapped](markdown-wrap.md)).
- **jj-kit loads the package's `src/index.ts` by relative path**, as it loads
  the changelog formatter, so formatting and the pre-commit hook need no build.
  - **Rejected: a `workspace:*` dependency by name**, whose `exports` point at
    `dist/`, which a fresh clone lacks.

## Why

- A base that holds only the shared settings can be adopted without a diff in
  repos that agree, and a repo's own taste stays a few visible lines in its own
  config.
- Imported plugins are the one form that works under every package manager.

## Consequences

- A consumer deletes its own `prettier-plugin-sh` and `sh-syntax`.
- A repo that wants `prettier-plugin-packagejson` installs it and lists it by
  name after `...PLUGINS`; a direct dependency resolves.
- A bump of `prettier-plugin-sh` that changes its `sh-syntax` range changes the
  kit's range with it; the zsh tests fail if the variant number no longer means
  zsh to the plugin.

## Links

- #7, which added the package.
- #10, which carries the `package.json` order into the kit's ESLint config.
- #45, which renames the package to `@jjloneman/jj-kit-prettier-config`.

[^prettier-plugins]:
    Prettier's docs show a config file importing a plugin and listing the
    module.

[^prettier-overrides]:
    The docs describe `overrides` and how `files` match, but not which of two
    matching overrides wins.
