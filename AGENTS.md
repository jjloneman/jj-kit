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

- `actions/<name>/` — one composite GitHub Action each, with its `action.yml`
  and a private `package.json`, so Changesets versions, changelogs and tags it
  (see [How the actions are versioned](docs/decisions/action-versions.md)).
  - `pack-release/` — decides whether a release run versions, publishes or does
    nothing, and builds and packs it without write access.
  - `require-changeset/` — fails a PR that adds no changeset.
  - `setup/` — installs pnpm, Node and the frozen-lockfile dependency tree; the
    prelude every CI job shares, with no code of its own.
  - `version-or-release/` — keeps the version PR open, or publishes what
    `pack-release` packed, with no code of its own.
  - `lib/` — code the two TypeScript actions share, such as annotations, reading
    the release plan and the Node check; not an action.
    - The actions import it by relative path (`../../lib/src/…`), since a
      consumer's runner has the whole repo at the pinned SHA but no
      `node_modules`.
    - `pack-release` and `require-changeset` each depend on it as `workspace:*`,
      so a release of `lib` also releases both; `setup` and `version-or-release`
      don't use it.
  - An action with logic of its own keeps it as zero-dependency TypeScript in
    its `src/`, with its own `tsconfig.json`, which Node runs unbuilt under type
    stripping, so it keeps `.ts` import specifiers.
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
  - `rulesets/main.json` — protects `main`.
- `.githooks/` — the `pre-commit` and `pre-push` hooks (#11 replaces them).
- `eslint-rules/` — the local `no-dotted-jsdoc-param` rule, loaded by
  `eslint.config.ts` (#9 replaces it).
- Root configs:
  - `eslint.config.ts` (#10), `prettier.config.ts` (#7) and `tsconfig.json`,
    which covers the root's own files only (#8), each copied from okf-tools
    until the package that replaces it lands;
  - `vitest.config.ts`, one Vitest project per package and action, which no kit
    package replaces.
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
- **A multi-line expression statement gets a blank line above and below it**,
  such as a `vi.mock(…)` or an `expect(…)` that wraps, as ESLint's
  `padding-line-between-statements` does for `multiline-expression`.
  - Declarations and imports stay grouped.
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
- **In a YAML list, a blank line separates an item that's an object with more
  than one key from its neighbors**, such as a workflow step with `with:`.
  - Single-key items, such as `- uses: …`, may sit together.
- **GitHub YAML follows a documented order instead**, in `.github/**/*.yml` and
  `actions/*/action.yml`.
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
  - Each package and action with a `package.json` is its own Vitest project.
- **`pnpm test:coverage` adds the gate:** **100%** statements, branches,
  functions, and lines across `actions/*/src` and `packages/*/src`.
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
    `include`, unless each package in it has its own `tsconfig.json`, as in
    `packages/` and `actions/`.

## 🤖 CI

- **`ci.yml` runs on every PR and push to `main`**, on Node 26:
  - `🧹 Lint & format`;
  - `🔷 Typecheck`;
  - `🧪 Tests`, with coverage;
  - `📦 Package`, `pnpm lint:package` in each package that defines it.
- **On a PR it also runs `🦋 Changeset`**, through the kit's own
  [require-changeset](actions/require-changeset/action.yml) action, which fails
  when the PR adds or edits no changeset, judged by `changeset status`'s own
  reader (see [Versioning & releases](#-versioning--releases)).
  - It skips the version PR (`changeset-release/main`) from this repo, opened by
    `github-actions[bot]`; a fork's or a person's branch of that name is still
    checked.
  - **A Renovate PR (`renovate/**` from this repo, opened by `renovate[bot]`)
    needs a changeset only when it ships a change:**
    - a change to a versioned package's `dependencies`, `optionalDependencies`,
      `peerDependencies`, `engines` or entry points, a `catalog:` entry they
      point to included, or to a file it publishes, such as an action's
      `action.yml`, needs a changeset that bumps each such package; the owner
      adds `pnpm changeset` to the Renovate branch;
    - any other file in a versioned package, such as a build config, needs a
      changeset, an empty one included;
    - versioned means Changesets would release it: a name and version, not in
      `ignore`, and public, or private while `privatePackages.version` is on, as
      it is here, so the actions count;
    - a dev dependency, or the monorepo root's bump, ships nothing, so it passes
      without one.
    - It reads `pnpm-workspace.yaml` through `yq` v4, which GitHub's Ubuntu
      runners ship.
- `release.yml` runs on every push to `main`, and by hand from "Run workflow"
  (see below), in two jobs:
  - `📦 Plan and pack`, with `contents: read` alone, runs the kit's own
    [pack-release](actions/pack-release/action.yml) action, which decides,
    builds and packs;
  - `🦋 Version PR or publish`, holding the write permissions, runs
    [version-or-release](actions/version-or-release/action.yml) only while
    there's something to do, with no build.
- **jj-kit uses its actions by local path** (`./actions/<name>`), so a PR's CI
  runs the actions as that PR changes them.
- **Every action is pinned to an exact `vX.Y.Z`.**
- **Every job's and every named step's `name` opens with an emoji**, and each
  step of the kit's own actions is named.
- **Every job declares its own `permissions`**, under a top-level
  `permissions: {}`.
- **Every `ci.yml` job is a required check** in
  [.github/rulesets/main.json](.github/rulesets/main.json), by its display name.
  - Renaming one, or adding one, means updating `required_status_checks` there
    and reapplying the ruleset.
  - **Never require `release.yml`'s jobs:** they run only on `main`, so they
    never report on a PR, and every PR would wait on them forever.
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
  - `release.yml` opens no version PR while every pending changeset is empty.
  - Instead, `pack-release` publishes past them whenever
    `changeset publish-plan` lists a version npm or the git tags lack; with
    nothing listed, it builds nothing and ends green.
  - The next real one's version PR deletes them all.
- **`release.yml` keeps a rolling `chore(release): 🚀 version packages` PR
  open** while changesets are pending, labeled `🚀 release` and assigned to
  `jjloneman`.
  - Its CI run is started by `github-actions[bot]`, so it waits for approval.
  - Approve it on the PR before merging, since `main` requires every check.
  - Squash-merging it bumps each package's `package.json` and writes its
    `CHANGELOG.md`.
  - **Its squash commit keeps the PR title as its subject**, with one
    `- release <name>@<version>` bullet per package or action it releases, the
    exact spec npm installs and the tag the release run makes, then `Refs:` for
    each issue whose changesets it ships.
    - The only trailer is GitHub's `Co-authored-by: github-actions[bot]`, since
      the bot wrote the PR's changes; no Claude trailer.

    ```text
    chore(release): 🚀 version packages (#20)

    - release @jjloneman/kit-changesets-changelog@0.1.0

    Refs: #4
    Co-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>
    ```

  - The run on that merge builds with `pnpm build` and packs in the plan job,
    then publishes the packed tarballs from the release job.
  - That publishes every package version npm doesn't have yet, and tags each as
    `<name>@<version>`, such as `@jjloneman/kit-tsconfig@1.0.0`.
  - Each action is tagged the same way, such as `require-changeset@1.0.0`, with
    nothing published.
- **If a version PR's merge published nothing, a newer push cancelled its run**,
  since the concurrency group doesn't queue.
  - The next push to `main` with no releasing changeset pending publishes it; to
    publish sooner, start `release.yml` on `main` from Actions → "Run workflow".
  - **Never use "Re-run jobs" on an old run:** it acts on that run's commit, so
    it could publish from a stale commit or rebuild the version PR without later
    changes.
- **A red `🦋 Version PR or publish` job on a docs or CI merge means a version
  is waiting to publish** and its publish failed, usually a new package's first
  version whose trusted publisher isn't set up yet.
  - Each push to `main` with only empty changesets retries it, so it stays red
    until fixed; fix the publish rather than the run (see
    [Why empty changesets don't block a publish](docs/decisions/publish-past-empty-changesets.md)).
- **Publishing uses npm trusted publishing** (OIDC, `id-token: write`), so no
  npm token exists.
  - Provenance is signed by the same identity.
- **A package's first version is published by hand**, with `--provenance=false`,
  before the first version PR that bumps it merges.
  - Trusted publishing can only be set up for a package that already exists, so
    the automated publish of a package npm has never seen fails partway.
  - **Publish it as a `0.0.1-stage` placeholder with `--tag stage`**, set with
    `npm pkg set version=0.0.1-stage` and reverted after, never committed.
    - As of 2026-11-26 npm reserves `0.0.0-stage` for its staged publishing and
      refuses it with a 403.
    - The placeholder is staged for a minute or two before `npm view` sees it.
  - The owner then adds `release.yml` as its trusted publisher, with "Allow npm
    publish" ticked, in an external browser: the Claude desktop app's browser
    pane can't answer npm's security-key 2FA.
    - It stays "Pending validation" until a publish goes through it, with a
      deadline about two days out, so merge the version PR before then.
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
