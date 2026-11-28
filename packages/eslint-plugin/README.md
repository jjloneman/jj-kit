# @jjloneman/kit-eslint-plugin

- The kit's own [ESLint](https://eslint.org) rules, for flat config, under the
  `jj-kit/` namespace.
- Part of [jj-kit](https://github.com/jjloneman/jj-kit), my shared repo kit.

## 📦 Install

- Node 26 or later, and ESLint 10.2 or later, the first release that enforces a
  rule's `meta.languages`.

```sh
pnpm add --save-dev --save-exact @jjloneman/kit-eslint-plugin
```

## 🔌 Setup

- **Extend `recommended` beside your own `files`**, which registers the plugin
  as `jj-kit` and turns every rule on as an error.
  - It sets no `files` of its own, so it lints whatever you name, `.vue` or
    `.svelte` files included.
  - The rule reads JavaScript only: turned on for a file a language plugin
    parses, such as Markdown, it stops ESLint with a config error naming the
    rule.

```ts
import kitPlugin from "@jjloneman/kit-eslint-plugin";
import { defineConfig } from "eslint/config";

export default defineConfig({
  extends: [kitPlugin.configs.recommended],
  files: ["**/*.ts"],
});
```

- **Under another namespace**, register the plugin under your own key and extend
  `recommended` by string; `defineConfig` renames its rules to match.
  - `recommended` still registers the plugin as `jj-kit` too, so a repo that
    already has a different plugin under `jj-kit` gets
    `Cannot redefine plugin "jj-kit"`; register the rules by hand from
    `kitPlugin.rules` there instead.

```ts
export default defineConfig({
  extends: ["docs/recommended"],
  files: ["**/*.ts"],
  plugins: { docs: kitPlugin },
});
```

- **One rule on its own** is a named export too:

```ts
import { NO_DOTTED_JSDOC_PARAM } from "@jjloneman/kit-eslint-plugin";
```

## 📏 Rules

| Rule                                              | Reports                      | Fixable |
| ------------------------------------------------- | ---------------------------- | ------- |
| [`no-dotted-jsdoc-param`](#no-dotted-jsdoc-param) | A dotted TSDoc `@param` name | No      |

### no-dotted-jsdoc-param

- **Reports a TSDoc `@param` whose name is dotted**, such as
  `@param options.prefix`.
  - An editor shows a property's doc comment at the call site, but nothing for a
    dotted `@param`, so the doc never reaches the one place it was for.
- **Put the comment on the property in the type literal instead.**
- It reads only `/** */` doc blocks, so it needs no type information and covers
  `.js` and `.mjs` files too.
  - It matches JSDoc's `@arg` and `@argument` aliases, its `employees[].name`
    form for an array's elements, a `{type}` with up to two levels of nested
    braces on one line, such as `{{ retry: { limit: number } }}`, an optional
    `[name]` or `[ name ]`, a Unicode name, and a line with no leading `*`.
  - Like TSDoc, it reads a `@param` partway through a line as a tag too, such as
    one after a single-line block's summary, unless it's glued to a word or sits
    in an inline code span.
  - It skips lines inside a fenced code block, such as an `@example`'s, read as
    TSDoc reads one: ` ``` ` right after the line's `* `, closed by the next
    such line.
    - A fence that never closes hides nothing, and a `@param` indented four
      spaces is still checked, since TSDoc has no indented code blocks.
- **Not fixable**: moving the text means finding the matching property, deleting
  it rather than moving it when the type is imported, and re-wrapping the prose.

- ❌ Fails:

```ts
/**
 * Formats a label.
 *
 * @param options.prefix - the text before the label.
 * @returns the prefix.
 */
function label(options: { prefix: string }): string {
  return options.prefix;
}
```

- ✅ Passes:

```ts
/**
 * Formats a label.
 *
 * @returns the prefix.
 */
function label({
  prefix,
}: {
  /** The text before the label. */
  prefix: string;
}): string {
  return prefix;
}
```
