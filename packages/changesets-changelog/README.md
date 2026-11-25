# @jjloneman/kit-changesets-changelog

- A [Changesets](https://github.com/changesets/changesets) changelog formatter
  that prefixes each line with the gitmoji and scope of the commit that added
  the changeset.
- After a squash merge, that commit's subject is the PR title, so a repo whose
  PR titles follow `<type>(<scope>): <gitmoji> <subject>` gets a changelog that
  reads like its history.
- Part of [jj-kit](https://github.com/jjloneman/jj-kit), my shared repo kit.

## 📦 Install

- Node 26 or later.

```sh
pnpm add --save-dev --save-exact @jjloneman/kit-changesets-changelog
```

- Then name it in `.changeset/config.json`:

```json
{ "changelog": "@jjloneman/kit-changesets-changelog" }
```

## 📝 Lines

- **Each changeset's line** is
  `- <gitmoji> **<scope>:** <summary> (<short hash>)`.
  - A `!` after the type adds `**Breaking:**` after the scope.
  - A subject that isn't a conventional commit just drops the prefix.
  - A commit git has no record of, such as a hash from before a squash, gives
    the bare summary with no hash.
  - A commit git fails to read for another reason keeps its hash, without a
    gitmoji or scope, and prints a warning.
  - A scope's Markdown characters are escaped, so `fix(*)` stays bold.
  - A summary's later lines are indented under the bullet.
- **Dependency bumps** get one `Updated dependencies` line naming the
  changesets' commits, then one sub-item per bumped package.
- **git runs from the current directory**, since Changesets passes the formatter
  none; run `changeset version` from the repo root, as it expects.
- **A sample `CHANGELOG.md`**, from a PR titled
  `feat(eslint-config): ✨ add the react preset (#12)`:

  ```md
  ## 1.1.0

  ### Minor Changes

  - ✨ **eslint-config:** Add the react preset. (b4fc42d)

  ### Patch Changes

  - Updated dependencies [0a1b2c3]
    - @jjloneman/kit-eslint-plugin@1.2.0
  ```

## 🧩 API

- The default export is Changesets'
  `{ getReleaseLine, getDependencyReleaseLine }`.
- `formatReleaseLine`, `parseConventionalSubject` and `readCommitSubject` are
  also exported, with their types, for reuse.
