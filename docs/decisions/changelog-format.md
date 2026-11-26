---
type: Decision
title: How changelog lines are built
description:
  "`kit-changesets-changelog` prefixes each changeset's line with the gitmoji
  and scope of the commit that added it, as okf-tools does, and adds one
  `Updated dependencies` line per dependency release; it reads git from the
  current directory, and jj-kit loads its source while consumers load `dist/`."
tags:
  - changelog
  - changesets
  - commits
  - consumers
  - dogfooding
  - git
  - gitmoji
  - kit-changesets-changelog
  - node
  - peer-dependencies
  - pull-requests
  - releases
  - testing
  - type-stripping
  - version-pr
sources:
  - id: changesets-changelog
    resource: https://github.com/changesets/changesets/blob/main/docs/modifying-changelog-format.md
    title: Changesets, modifying the changelog format
  - id: node-type-stripping
    resource: https://nodejs.org/api/typescript.html
    title: Node.js, modules and TypeScript
  - id: okf-tools-changelog-formatter
    resource: https://github.com/jjloneman/okf-tools/blob/main/docs/decisions/changelog-formatter.md
    title: okf-tools, How changelog lines are built
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T23:18:56Z }
verified: { by: human:jjloneman, at: 2026-11-26T01:05:37Z }
---

# How changelog lines are built

- Changesets' stock formatter writes `- <short hash>: <summary>` and reads no
  commit messages.
- The owner's PR titles already carry a type, a scope and a gitmoji, and
  okf-tools built its changelog from them with a formatter script of its
  own[^okf-tools-changelog-formatter].
- The kit ships that formatter as a package, so every repo's changelog reads the
  same way without a copied script.

## Decision

- **As of 2026-11-25,** from `packages/changesets-changelog/src/index.ts` and
  `.changeset/config.json`.
- **Each changeset's line keeps okf-tools' format:**
  `- ✨ **scope:** <summary> (<short hash>)`, from the subject of the commit
  that added the changeset, which after a squash merge is the PR title.
  - **The hash stays at the end of the summary's first line**, even when the
    summary runs on to later lines.
    - **Rejected: the hash first, as the stock formatter writes it,** which the
      owner declined in #4's review to keep okf-tools' format.
  - A `!` after the type adds `**Breaking:**`, and Markdown in a scope is
    escaped.
  - A commit git has no record of, such as a hash from before a squash, gives
    the bare summary with no hash.
  - **A commit git fails to read for another reason keeps its hash**, with no
    gitmoji or scope and a warning, since the hash came from the repo's own
    history.
    - **Rejected: okf-tools' rule of dropping the hash on any failure,** which
      would strip valid hashes from every line when git refuses to run, such as
      on a CI checkout it calls dubious ownership.
  - A missing commit is told apart from a git failure by
    `git rev-parse --verify --quiet`'s exit status, not git's messages, so it
    holds in any locale; the hash goes after `--end-of-options`, so it is never
    read as an option.
  - `--no-show-signature` keeps `log.showSignature` from putting gpg's check
    ahead of the subject, and a timeout with lazy fetches and prompts off keeps
    a partial clone from hanging.
- **A dependency release gets one `- Updated dependencies [<short hashes>]`
  line**, each changeset's commit once, then one `  - <name>@<version>` per
  bumped dependency.
  - **Rejected: okf-tools' empty dependency line,** which suits one package but
    would leave a kit package's release from a dependency bump with no line at
    all.
  - **Rejected: the stock formatter's one `Updated dependencies` line per
    changeset,** which repeats itself when several changesets bump one
    dependency.
  - A dependency changesets passes with no new version, a `none` release, is
    left out rather than printed as `name@undefined`.
  - Its hashes aren't checked the way a changeset's own line checks its hash;
    #10, whose version PR writes the kit's first dependency line, checks whether
    they need to be.
  - It takes changesets' positional `(changesets, dependenciesUpdated)`, an
    exception to AGENTS.md's single-object rule that changesets' call forces.
- **git runs from `process.cwd()`**, not from a path relative to the file.
  - Changesets passes the formatter no directory, and once installed the file
    lives in `node_modules`, outside the repo.
  - **Rejected: okf-tools' repo root found from the file's own path,** which
    only works for a script inside the repo.
  - It differs from the directory changesets read the commits from only through
    changesets' programmatic API called from elsewhere; each line then falls
    back to the bare summary.
- **Each commit is read with a blocking `execFileSync`**, cached per repo and
  hash.
  - **Rejected: async reads run in parallel,** which changesets would accept,
    but which would buy nothing noticeable for a release's handful of commits
    (#4's review).
- **jj-kit loads the package's source**,
  `../packages/changesets-changelog/src/index.ts`, under Node's type
  stripping[^node-type-stripping], so versioning never needs a build first.
  - The source uses only erasable syntax and `.ts` import specifiers.
  - **Consumers load the built `dist/`**, since Node refuses to strip types
    under `node_modules`.
- **`@changesets/cli` `^3.0.0` is a peer dependency**, the version the formatter
  is tested with, as the kit makes every tool a package plugs into a peer.
  - The package declares its own narrower types, so its published declarations
    import nothing from changesets; a test assigns its default export to
    `@changesets/types`' `ChangelogFunctions`, so the typecheck fails if
    changesets' signatures stop accepting it.

## Why

- A changelog that reads like the commit history needs no second vocabulary; the
  gitmoji already shows the kind of change.
- Loading the source keeps jj-kit's own changelog on the code under review, so a
  formatter bug shows in the next version PR rather than a release later.

## Consequences

- A PR title is its changelog line's prefix, so it has to follow the commit
  conventions; a non-conventional title just drops the prefix.
- `changeset version` must run from the repo root, which the Changesets CLI and
  action already do.
- okf-tools' own record goes stale once okf-tools adopts the package; that's for
  okf-tools' migration.

## Links

- #4, which builds the package.
- #10, which checks the dependency line's hashes.
- #1, the roadmap.

[^changesets-changelog]:
    Changesets lets `changelog` name a module exporting `getReleaseLine` and
    `getDependencyReleaseLine`, and groups their lines under its own bump-type
    headings.

[^node-type-stripping]:
    Node strips erasable TypeScript syntax when it loads a `.ts` file, and
    refuses to for files under `node_modules`.

[^okf-tools-changelog-formatter]:
    okf-tools' `scripts/changelog.ts` builds each line from the squash commit's
    gitmoji and scope, and returns no dependency line.
