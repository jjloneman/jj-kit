---
type: Decision
title: How the ESLint plugin is shaped
description:
  "`kit-eslint-plugin` registers its rules under the `jj-kit` namespace, set as
  `meta.namespace` too, exports the plugin as its default and each rule by name,
  and is loaded from source by jj-kit's own ESLint config; rules that only
  jj-kit uses stay in `eslint-rules/`."
tags:
  - dogfooding
  - eslint
  - kit-eslint-plugin
  - naming
  - peer-dependencies
sources:
  - id: eslint-plugin-meta
    resource: https://eslint.org/docs/latest/extend/plugins#meta-data-in-plugins
    title: "ESLint docs, Create Plugins: Meta Data in Plugins"
  - id: eslint-plugin-configs
    resource: https://eslint.org/docs/latest/extend/plugins#configs-in-plugins
    title: "ESLint docs, Create Plugins: Configs in Plugins"
  - id: eslint-configure-plugins
    resource: https://eslint.org/docs/latest/use/configure/plugins#use-plugin-rules
    title: "ESLint docs, Configure Plugins: Use Plugin Rules"
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-28T08:55:15Z }
---

# How the ESLint plugin is shaped

- The owner's repos each carried a copy of the same `no-dotted-jsdoc-param`
  rule, registered as `local/`, in diverging versions.
- Publishing it needs a rule ID prefix, an export shape, and a way for jj-kit to
  lint itself with the code under review.

## Decision

- **As of 2026-11-28,** from `packages/eslint-plugin/`, as #9 built it.
- **The namespace is `jj-kit`**, so the rule is `jj-kit/no-dotted-jsdoc-param`.
  - `recommended` registers the plugin under `jj-kit` and turns every rule on as
    an error, its list built from `rules` so a new rule is on the day it's
    added.
  - `recommended` sets no `files`, as ESLint's own plugin
    docs[^eslint-plugin-configs] and typescript-eslint's rules config don't; a
    repo scopes it with `extends` beside its own `files`.
    - **Rejected: `files` set to the JavaScript and TypeScript extensions,**
      since `extends` intersects it with the repo's own `files`, so a repo that
      extends it for `.vue` or `.svelte` files would lint nothing, with no
      warning, and the `jj-kit` key wouldn't be registered there either (the
      owner chose on 2026-11-28).
    - **Rejected: `recommended` as an array,** with the plugin registered in an
      entry that has no `files` and the rules in one that has; it registers the
      key everywhere, but the rules entry still intersects with the repo's
      `files`, and the type change ripples into every example.
    - The rule's `meta.languages` is `js/js`, so a repo that turns it on for a
      file a language plugin parses, such as Markdown, whose source has no
      JavaScript comments, gets a config error from ESLint naming the rule,
      rather than the rule crashing (read in ESLint 10.15.0's
      `lib/config/config.js`).
  - `meta.namespace` is `jj-kit` too, so `defineConfig` renames `recommended`'s
    rules when a repo registers the plugin under its own key and extends
    `<key>/recommended`[^eslint-plugin-meta]; `src/index.test.ts` checks it.
    - It renames only the rules: `recommended` still registers the plugin as
      `jj-kit`, so a repo that already has another plugin under that key gets
      `Cannot redefine plugin "jj-kit"`, which a test also pins.
  - **Rejected: `kit`,** shorter, and matching the `kit-` package prefix; the
    owner chose `jj-kit` on 2026-11-28, since "kit" could mean anything.
    - The prefix isn't only in configs and disable comments: ESLint prints the
      rule ID beside every violation, in the CLI, in the editor and as `ruleId`
      in JSON output.
  - **Rejected: `jjloneman`,** the npm scope, which also holds the owner's
    packages outside the kit; flat config takes any key the `plugins` object
    uses[^eslint-configure-plugins].
  - **Rejected: `local`,** today's prefix, since it means a rule defined in the
    repo itself, which jj-kit's own `pinned-uses` still is.
  - **Rejected: no `meta.namespace`,** which leaves a repo that registers the
    plugin under another key with rule names that don't match it.
- **The default export is the plugin; each rule is a named export too**, such as
  `NO_DOTTED_JSDOC_PARAM`.
  - **Rejected: a default export only,** which would make a repo reach into
    `plugin.rules` to register one rule under its own namespace.
- **`eslint` `^10.2.0` is a peer dependency, and the package has no runtime
  dependencies.**
  - 10.2.0 is the first release whose `lib/config/config.js` checks a rule's
    `meta.languages` (read at each tag from 10.0.0 to 10.5.0); before it, the
    rule turned on for a Markdown file would crash rather than stop with a
    config error.
  - **Rejected: `@typescript-eslint/utils`' `RuleCreator`,** a runtime
    dependency for a rule that reads only comment text and needs no type
    information.
- **jj-kit's `eslint.config.ts` imports `packages/eslint-plugin/src/index.ts`**,
  as `.changeset/config.json` loads `kit-changesets-changelog`'s source.
  - Consumers load the built `dist/`.
  - ESLint's cache identifies a plugin by its `meta` name and version, which
    stay the same while the source changes, so `eslint.config.ts` adds a hash of
    the plugin's `src/` to the version as build metadata, and a rule edit
    invalidates `.eslintcache`.
    - It rewrites `meta.version` on the plugin object itself, since
      `recommended` registers that object as `jj-kit` and ESLint refuses a
      second, different object under the same key.
  - **Rejected: linting with the built `dist/`** through a `workspace:*` dev
    dependency, which would need `pnpm build` before every `pnpm lint`,
    `pre-commit` hook and CI lint job, and would lint with a stale build.
- **A rule moves into the plugin once more than jj-kit uses it.**
  - `pinned-uses` stays in `eslint-rules/`, registered as `local/`, until #10
    decides where it lands.
  - The two YAML rules proposed on #9, a blank line between multi-key list items
    and an emoji opening each job's and step's `name`, are left to #44.
- **The rule reads fenced code blocks as TSDoc's own parser does**, checked
  against `@microsoft/tsdoc` 0.17.1 on 2026-11-28, since it lints TSDoc
  comments.
  - A fence is ` ``` ` right after the line's `* `, with no backtick in its info
    string, and the next such line closes it, even with text after it.
  - A fence that never closes hides nothing, and a `@param` indented four spaces
    is still checked: TSDoc reports the missing fence and reads both as block
    tags.
  - A `@param` partway through a line, after a space or a `*`, is a block tag
    too, such as one after a single-line block's summary, so the rule reports
    it; one glued to a word or inside an inline code span isn't.
  - **Rejected: CommonMark's rules,** with `~~~` fences, longer backtick fences,
    fences that run to the end and indented code blocks, which hide `@param`
    tags TSDoc reads.
- **`no-dotted-jsdoc-param` is not fixable**, as every copy before it was:
  moving the text means finding the matching property, deleting rather than
  moving it when the type is imported, and re-wrapping prose.

## Why

- A rule ID names where the rule comes from, and `jj-kit` traces it to this repo
  from a CI log or an editor's problem list.
- One published rule ends the drift between copies, and the named exports keep
  the rule usable under a repo's own namespace.
- Loading the source keeps jj-kit's lint on the code under review, so a rule bug
  shows in the PR that adds it.

## Consequences

- A repo that adopts the plugin renames every `eslint-disable` comment naming
  `local/no-dotted-jsdoc-param` to `jj-kit/no-dotted-jsdoc-param`.
- `kit-eslint-config` (#10) depends on the plugin and turns `recommended` on for
  TypeScript.

## Links

- #9, the issue that built it.
- #10, the ESLint config that wires it in.
- #44, the YAML rules left out of it.
- #1, the roadmap.

[^eslint-plugin-meta]:
    The docs say a plugin's namespace lets `defineConfig()` find it even when a
    user registers it under a different key; jj-kit installs
    `@eslint/config-helpers` 0.7.0, whose `normalizePluginConfig` does the
    renaming.

[^eslint-plugin-configs]:
    The docs' example `recommended` config sets `plugins`, `rules` and
    `languageOptions` but no `files`, and its user-side example puts `files`
    beside `extends` in the user's own config.

[^eslint-configure-plugins]:
    The docs register `eslint-plugin-jsdoc` under the key `jsd`, so its rules
    take that prefix.
