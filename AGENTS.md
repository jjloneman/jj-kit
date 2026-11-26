# 🤖 AGENTS.md

- Conventions for any AI agent (or human) working in this repo.
- Read top to bottom before editing.

## 🎯 Purpose of this repo

- **jj-kit is the owner's shared repo kit**: the lint, format, TypeScript, git
  hook, changelog and CI setup every one of their repos inherits instead of
  copying.
  - See [README.md](README.md) and the roadmap, #1.
- **A public pnpm-workspace monorepo** of npm packages under `@jjloneman/kit-*`,
  each versioned on its own, plus composite GitHub Actions.
- **It's public**, so nothing here names or links a private repo: not code,
  docs, commits, issues or PRs.
  - Write "a personal project" instead.
- **Until each package or action ships, the root runs on files copied from
  okf-tools.**
  - Each copied file opens with a header naming the issue that replaces it.
  - Keep that header when editing one, and give any new copy the same.

## 🗂️ Project layout

- `packages/<name>/` — one npm package each, with its own `package.json` and
  `tsconfig.json`, built with its own `tsdown.config.ts` unless it ships JSON
  only.
  - `changesets-changelog/` — `@jjloneman/kit-changesets-changelog`, the gitmoji
    changelog formatter, which jj-kit's own `.changeset/config.json` loads from
    source.
  - Each package's `tsconfig.json` is copied from okf-tools until #8.
- `docs/decisions/` and `docs/references/` — the repo's own OKF bundles (see
  [Design decisions](#-design-decisions)).
- `.changeset/` — pending changesets (see
  [Versioning & releases](#-versioning--releases)).
- `.github/`:
  - `workflows/` — `ci.yml` and `release.yml`;
  - `actions/setup/` — the shared pnpm + Node + install prelude (#6 replaces
    it);
  - `rulesets/main.json` — protects `main`.
  - `scripts/renovate-ships.sh` — decides whether a Renovate PR needs a
    changeset (#5 replaces it).
- `.githooks/` — the `pre-commit` and `pre-push` hooks (#11 replaces them).
- `eslint-rules/` — the local `no-dotted-jsdoc-param` rule, loaded by
  `eslint.config.ts` (#9 replaces it).
- Root configs:
  - `eslint.config.ts` (#10), `prettier.config.ts` (#7) and `tsconfig.json`,
    which covers the root's own files only (#8), each copied from okf-tools
    until the package that replaces it lands;
  - `vitest.config.ts`, one Vitest project per package, which no kit package
    replaces.
- `pnpm-workspace.yaml` — the workspace, the shared `catalog` of dev dependency
  versions (referenced as `catalog:`), and the
  [moratorium](#-7-day-dependency-moratorium).

## 🎨 Code style

- **Strict TypeScript:**
  - no `any`;
  - exported functions declare their return type (`isolatedDeclarations`
    enforces it);
  - `type` over `interface`;
  - `import type` for type-only imports.
- **A `catch` binding is `unknown`**: narrow it with `instanceof` and `typeof`,
  never cast it.
- **Function parameters**: one positional parameter is fine; with two or more,
  take a single object with sorted keys.
- **Named functions are `function` declarations**; arrows are for callbacks and
  closures.
- **Braces always**, even around a one-line `if` body.
- **An unused name keeps a `_` prefix** rather than being dropped, such as
  `const [_file, args] = call`, so it still says what it is.
- **Semantic names:**
  - module constants are `SCREAMING_SNAKE_CASE`;
  - boolean names read as questions, opening with an auxiliary verb (`is`,
    `has`, `should`, `can`, …).
- **Lexicographic ordering** of everything perfectionist's
  `recommended-alphabetical` preset sorts.
- **80 columns** for code, comments and Markdown.
- **Markdown is bullets and sub-bullets**, not prose paragraphs.
  - Prettier wraps them at 80 (`proseWrap: "always"`), frontmatter included, so
    write each bullet as one line and let `pnpm format` wrap it.
  - Tables, URLs and inline code in the body can't wrap, so leave those lines
    long rather than splitting them by hand; in frontmatter, Prettier may split
    inline code across lines.
  - Changesets (`.changeset/*.md`, but not its `README.md`) aren't wrapped, so
    each summary reaches `CHANGELOG.md` as one line.
  - See [How Markdown is wrapped](docs/decisions/markdown-wrap.md).
- **Comments say only _why_.**
  - A comment of three lines or more opens with one prose sentence, then `-`
    bullets.
  - Once any bullet wraps, blank lines separate them all.
  - Put a blank line before a comment unless it's the first thing in its block.
- **American English** in all prose.

### TSDoc conventions

- **A doc comment on every function**, exported or not, with an `@returns` when
  it returns a value.
- **Every property of a named type gets its own doc comment.**
  - A doc comment that fits on one line within 80 columns, `@example` included,
    is written on one line.
- **A positional parameter gets an `@param` tag**, such as one an outside caller
  forces.
- **Document a destructured object parameter on its type literal's properties**,
  never with a dotted `@param options.key`.
  - An editor shows a property's comment at the call site, but nothing for a
    dotted `@param`.
  - `local/no-dotted-jsdoc-param` enforces it.

  ```ts
  /**
   * Greets someone by name, once or more.
   *
   * @returns the greeting, such as `hi Ada hi Ada`.
   */
  function greet({
    count,
    name,
  }: {
    /** How many times to repeat the greeting. */
    count: number;

    /** Who to greet. */
    name: string;
  }): string {
    return Array.from({ length: count }, () => `hi ${name}`).join(" ");
  }
  ```

### Key order

- **JSON and YAML keys are alphabetized at every level**, `package.json`
  included.
  - ESLint's `jsonc/sort-keys` and `yml/sort-keys` enforce it, and
    `pnpm lint:fix` sorts them.
- **GitHub YAML follows a documented order instead**, in `.github/**/*.yml`.
  - The orders live in `eslint.config.ts`'s `yml/sort-keys` options, and
    `pnpm lint:fix` applies them.
  - A workflow's or action's top level: `name`, `description`, `title`,
    `labels`, `on`, `inputs`, `outputs`, `concurrency`, `permissions`, `env`,
    `defaults`, `jobs`, `runs`.
  - A job: `name`, `if`, `needs`, `runs-on`, `permissions`, `strategy`,
    `outputs`, `env`, `steps`.
  - A step: `name`, `id`, `if`, `uses`, `with`, `env`, `shell`, `run`.
  - An action's `runs`: `using`, `steps`; a schedule entry: `cron`, `timezone`.
  - Only keys a list doesn't name are alphabetized, after the named ones.

## ✍️ Commit conventions

- **[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
  with a gitmoji after the colon**: `<type>(<scope>): <gitmoji> <subject>`.
- **The subject is imperative and fully lowercase** after the prefix, names and
  acronyms included.
- **A body, when needed, is `-` bullets**, not prose.

| Type       | Gitmoji | Use for                              |
| ---------- | ------- | ------------------------------------ |
| `build`    | 🛠️      | the build system and typecheck setup |
| `chore`    | 🔧      | config and tooling                   |
| `chore`    | 🧹      | housekeeping                         |
| `chore`    | ⬆️      | dependency bumps                     |
| `ci`       | ☁️      | CI and workflows                     |
| `docs`     | 📝      | documentation                        |
| `feat`     | ✨      | a new feature                        |
| `fix`      | 🔧      | a bug fix                            |
| `perf`     | ⚡️      | performance                          |
| `refactor` | 🏗️      | a refactor                           |
| `revert`   | ⏪️      | reverting an earlier commit          |
| `style`    | 🎨      | formatting only, no behavior change  |
| `test`     | 🧪      | tests                                |

- **The scope names a package without its prefix**
  (`feat(eslint-config): ✨ …`), or the area touched (`repo`, `ci`, `deps`).
- **Dependency bumps:** `chore(deps): ⬆️ bump <package> from <x> to <y>`, or
  `chore(deps-dev): ⬆️ …` for dev dependencies.
- **Branches** are `<prefix>/gh-<n>-<slug>`, such as
  `chore/gh-12-changesets-release-okf-agent-docs`:
  - the prefix is `feature/`, `bugfix/`, `release/`, or `chore/` for everything
    else;
  - `<n>` is the issue, and the slug is kebab-case.
- **PRs are squash-merged**, so the PR title becomes the commit on `main`.
  - It matches the issue's title.
- **`main` is protected** by
  [.github/rulesets/main.json](.github/rulesets/main.json):
  - changes land through a squash-merged PR;
  - unresolved review threads block the merge;
  - every CI job must pass;
  - there are no force pushes or deletion.
- **After editing the ruleset, reapply it** with
  `gh api --method PUT repos/jjloneman/jj-kit/rulesets/28043220 --input .github/rulesets/main.json`.
  - A `PUT` replaces the whole ruleset, so the file keeps every field.

## 🏷️ Labels and the AI banner

- **Issues and PRs are assigned to `jjloneman`** and labeled by kind, spelling
  the emoji-prefixed labels exactly:
  - `✨ feature`, `🐞 bug`, `📝 documentation`, `📦 dependencies`, `🔧 tooling`,
    `🤖 ci`;
  - `🚀 release` is the version PR's, added by `release.yml`;
  - `🗺️ tracking` is for the roadmap and other tracking issues.
- **Bugs use 🐞**, in labels and headings; a `fix` commit keeps 🔧.
- **AI-written text on GitHub opens with a disclaimer banner**:
  `> **🤖 Disclaimer**: This description was generated with AI. (**Model**: _<model name and version>_)`.
  - A comment says "comment" in place of "description".

## 🧪 Testing

- **`pnpm test` runs every package's tests** as one Vitest workspace from the
  root.
  - Each package with a `package.json` is its own Vitest project.
- **`pnpm test:coverage` adds the gate:** **100%** statements, branches,
  functions, and lines across `packages/*/src`.
- A branch nothing can reach is dead code to delete, not a line to exempt; no
  coverage-ignore comments.
- **Test data is fabricated.** Never copy a real repo's files into a test.
- **`vi.mock` takes `import("<module>")`, not the module's path as a string**,
  so the factory's return is typed against the real module.
- **Shape:** `describe("<unit>")` → `test("<scenario>")`.
  - `// Given` / `// When` / `// Then` comments, each followed by a hyphen and
    what that phase holds.
  - Table tests name rows with `$description`.

## ✅ Pre-commit checks

- **Run `pnpm check` before committing**, every gate CI requires except
  `🦋 Changeset`:
  - it fixes lint and formatting;
  - then runs the typecheck, the tests with coverage and the package checks.
  - It rewrites files, so read the diff after.
- **`pnpm install` points `core.hooksPath` at `.githooks/`:**
  - `pre-commit` lints and formats the staged files;
  - `pre-push` typechecks the project.
- Don't bypass the hooks (`--no-verify`) without the owner's approval.
- **ESLint's typed lint needs every `.ts` file inside a project**, through the
  nearest `tsconfig.json`.
  - A new top-level folder of `.ts` files goes in the root `tsconfig.json`'s
    `include`.

## 🤖 CI

- **`ci.yml` runs on every PR and push to `main`**, on Node 26:
  - `🧹 Lint & format`;
  - `🔷 Typecheck`;
  - `🧪 Tests`, with coverage;
  - `📦 Package`, `pnpm lint:package` in each package that defines it.
- **On a PR it also runs `🦋 Changeset`**, which fails when the PR adds or edits
  no changeset, judged by `changeset status`'s own reader (see
  [Versioning & releases](#-versioning--releases)).
  - It skips the version PR (`changeset-release/main`) from this repo; a fork's
    branch of that name is still checked.
  - **A Renovate PR (`renovate/*`) from this repo needs a changeset only when it
    ships a change**, which
    [.github/scripts/renovate-ships.sh](.github/scripts/renovate-ships.sh)
    decides:
    - a change to a package's `dependencies`, `optionalDependencies`,
      `peerDependencies` or `engines`, a `catalog:` entry they point to
      included;
    - a dev dependency or root bump ships nothing, so it passes without one.
    - When one is needed, it must bump a package, not be empty; the owner adds
      `pnpm changeset` to the Renovate branch.
    - **The script needs bash 5** (`inherit_errexit`) and `yq` v4, both on
      GitHub's Ubuntu runners.
      - macOS's built-in bash 3.2 can't run it; to test it locally,
        `brew install bash yq`.
- `release.yml` runs on every push to `main`, and by hand from "Run workflow"
  (see below).
- **Every action is pinned to an exact `vX.Y.Z`.**
- **Every job declares its own `permissions`**, under a top-level
  `permissions: {}`.
- **Every `ci.yml` job is a required check** in
  [.github/rulesets/main.json](.github/rulesets/main.json), by its display name.
  - Renaming one, or adding one, means updating `required_status_checks` there
    and reapplying the ruleset.
  - **Never require `release.yml`'s `🦋 Version PR or publish`:** it runs only
    on `main`, so it never reports on a PR, and every PR would wait on it
    forever.
  - **Reapply only after the new job has reported once on the PR**, or every PR
    waits on a check that never reports.

## 🕒 7-day dependency moratorium

- **No npm dependency may enter the lockfile until it has been published for at
  least 7 days**, enforced by `minimumReleaseAge: 10080` in
  [pnpm-workspace.yaml](pnpm-workspace.yaml).
- **Pick the newest version that is at least 7 days old**, checked with
  `npm view <package> time`.
  - If the lockfile fails the check, downgrade the entry rather than relaxing
    the floor.
- **The owner's own `@jjloneman/*` packages skip it**, through
  `minimumReleaseAgeExclude`, so a kit release is usable the day it ships.
  - Their own dependencies still go through the floor.
- The floor doesn't apply to git dependencies, which have no publish date, so
  don't add one.
- **Versions are pinned exactly** (`saveExact: true`).
  - A dev dependency more than one package uses lives in the `catalog`.
- **TypeScript stays on 6.0.x** while `typescript-eslint` peers on
  `typescript <6.1.0`.
- **`typescript-eslint` moves together with `@typescript-eslint/utils`** in the
  catalog.

## 🚀 Versioning & releases

- **Releases use [changesets](https://github.com/changesets/changesets).**
- **Each package is versioned on its own**, with no `fixed` or `linked` groups,
  and follows SemVer.
- **Every PR adds or edits a changeset**, and CI fails one that doesn't.
  - The version PR, and a Renovate PR that ships nothing, are exempt (see
    [CI](#-ci)).
  - A PR that changes what a package ships runs `pnpm changeset`, naming each
    package it bumps, the bump, and the summary for that package's
    `CHANGELOG.md`.
  - A PR that only touches tooling, tests, CI, or docs runs
    `pnpm changeset --empty`, which records no release.
  - **Name every package you want released.** A package that depends on another
    kit package is bumped on its own only when the new version falls outside the
    range it depends on.
    - `updateInternalDependencies: patch` only updates that range in a dependent
      that's already being released.
- **Changelog lines come from `@jjloneman/kit-changesets-changelog`**, loaded
  from `packages/changesets-changelog/src/index.ts` under Node's type stripping,
  so versioning needs no build first.
  - Each line takes the gitmoji and scope of the PR title that added the
    changeset, so a PR title that breaks the commit conventions loses them.
  - The source must stay erasable syntax with `.ts` import specifiers.
  - See [How changelog lines are built](docs/decisions/changelog-format.md).
- **Empty changesets never release.**
  - `release.yml` skips the version PR while every pending changeset is empty.
  - The next real one's version PR deletes them all.
  - A run on `main` with only empty changesets pending logs "All changesets are
    empty. Not creating PR" and ends green; that's success, not a failure.
    - It never logs "No unpublished projects to publish", since it never reaches
      the publish step.
- **`release.yml` keeps a rolling `chore(release): 🚀 version packages` PR
  open** while changesets are pending, labeled `🚀 release` and assigned to
  `jjloneman`.
  - Its CI run is started by `github-actions[bot]`, so it waits for approval.
  - Approve it on the PR before merging, since `main` requires every check.
  - Squash-merging it bumps each package's `package.json` and writes its
    `CHANGELOG.md`.
  - The run on that merge runs `pnpm release`
    (`pnpm build && changeset publish`).
  - That publishes every package version npm doesn't have yet, and tags each as
    `<name>@<version>`, such as `@jjloneman/kit-tsconfig@1.0.0`.
- **If a version PR's merge published nothing, check why before acting:**
  - **A newer push cancelled its run**, since the concurrency group doesn't
    queue: start `release.yml` on `main` from Actions → "Run workflow".
  - **An empty changeset landed on `main` just before the merge**, so the action
    took its "all empty" path: it publishes with the next version PR's merge,
    since `changeset publish` publishes every version npm doesn't have yet.
  - **Never use "Re-run jobs" on an old run:** it acts on that run's commit, so
    it could publish from a stale commit or rebuild the version PR without later
    changes.
  - #5 replaces this.
- **Publishing uses npm trusted publishing** (OIDC, `id-token: write`), so no
  npm token exists.
  - Provenance is signed by the same identity.
- **A package's first version is published by hand**, with `--provenance=false`,
  before the first version PR that bumps it merges.
  - Trusted publishing can only be set up for a package that already exists, so
    the automated publish of a package npm has never seen fails partway.
  - The owner then adds `release.yml` as its trusted publisher.
- **Never hand-run a version bump or `git tag`**; the version PR owns both.
- `CHANGELOG.md` is in `.prettierignore`, since changesets writes it.

## 📚 Design decisions

- **Why the kit works the way it does is recorded in two
  [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
  v0.2 bundles:**
  - [docs/decisions/](docs/decisions/index.md) — one Markdown file per decision;
  - [docs/references/](docs/references/index.md) — reference material, such as
    the architecture.
- **Each bundle lists its records in its `index.md`.**
- **A record's `tags` are a YAML block list**, one `- tag` per line, sorted
  alphabetically, naming every specific subject it covers.
  - Each comes from its bundle's tag vocabulary in `index.md`; add a new tag
    there first.
- **They're signed off with [okf-tools](https://github.com/jjloneman/okf-tools)'
  `okf-verify`**, configured by `okf.bundles` and `okf.verifiedBy` in
  `package.json`.
- **Base a record on the code and the closed threads**, not on memory.
  - Re-read the code before stating a setting or a fallback.
  - Date-stamp facts that can drift ("as of 2026-11-25").
- **An agent writes a record as `status: draft`** and records itself in
  `generated`, as `<producer>/<version>` (`claude-code/<model-id>`).
  - It never adds a `verified` entry on its own.
- **Never make up a date or time** in a record: `generated.at`, an "as of" date,
  anything.
  - Read it right before writing it: `date -u +%Y-%m-%dT%H:%M:%SZ` for a
    timestamp, `date -u +%Y-%m-%d` for an "as of" date.
  - A `generated.at` ahead of the clock doesn't take a sign-off: okf-tools reads
    a record as changed while `generated.at` is later than `verified.at`.
- **An agent verifies only when the owner asks**, with
  `pnpm okf:verify --yes <paths>`.
  - Name the files rather than passing `--changed`, unless the owner asked for
    every changed record.
  - **It commits the stamp itself**, such as
    `docs(decisions): 📝 verify 1 decision record`, and never pushes; push it
    after.
    - Pass `--no-commit` to leave the edit uncommitted instead.
- **Check a record's `verified` before changing the behavior it describes:**
  - any `verified` entry means someone signed it off (usually `human:jjloneman`,
    the owner), so change the behavior only with the owner's agreement;
  - no `verified` means it is an unreviewed draft.
- **Either way, update the record in the same PR as the change.**
  - Re-stamp `generated` (`by` and `at`, the time read from `date -u`), so a
    signed-off record shows as changed until it is verified again.

## 🛑 Deleting things

- **Confirm with the owner before deleting anything the current task didn't
  create:**
  - files;
  - branches;
  - issues;
  - remote state.
