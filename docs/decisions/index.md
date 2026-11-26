---
okf_version: "0.2"
---

# Decisions

- [How a record's tags are laid out](tags-layout.md) - A record's `tags` are a
  YAML block list, one `- tag` per line, sorted alphabetically, naming every
  specific subject the record covers, each from the bundle's tag vocabulary; not
  a one-line flow list.
- [How changelog lines are built](changelog-format.md) -
  `kit-changesets-changelog` prefixes each changeset's line with the gitmoji and
  scope of the commit that added it, as okf-tools does, and adds one
  `Updated dependencies` line per dependency release; it reads git from the
  current directory, and jj-kit loads its source while consumers load `dist/`.
- [How Markdown is wrapped](markdown-wrap.md) - Prettier wraps Markdown at 80
  columns, frontmatter included, through a `proseWrap` override for Markdown
  files only that leaves changesets unwrapped, so each summary reaches
  `CHANGELOG.md` as written.
- [How the actions are versioned](action-versions.md) - Each action is a private
  workspace package under `actions/`, which Changesets versions, changelogs and
  tags as `<name>@<version>` with nothing published; consumers pin it by SHA
  with that tag in a comment, and a Renovate preset to update those pins is a
  follow-up.
- [How the monorepo is built](workspace-tooling.md) - A plain pnpm workspace
  with Changesets, and no monorepo framework such as Nx, Turborepo or Lerna;
  shared versions live in a pnpm catalog, packages depend on each other as
  `workspace:*`, tsdown builds them and publint plus attw check what they
  publish.
- [How the repo and its packages are named](naming.md) - The repo is `jj-kit`,
  and each package is `@jjloneman/kit-<name>` under the owner's existing npm
  scope, so the packages sort together and Renovate can group them by prefix.
- [How the shared tsconfigs are split](tsconfig-split.md) - `kit-tsconfig` ships
  four bases split by how code runs: `base.json` for the strict checks every
  project shares, `node.json` for code Node runs under type stripping,
  `bundler.json` for bundled code and `lib.json` for published packages,
  following the TypeScript docs' module templates.
- [What the actions require of a consumer](action-requirements.md) - The kit's
  actions run on a Linux or macOS runner after the consumer's own setup step,
  with Node 26, pnpm, `@changesets/cli` 3 or later and, for a Renovate PR, `yq`
  v4; they fail clearly when Node or the Changesets CLI is too old, rather than
  bringing their own.
- [Which token opens the version PR](version-pr-token.md) - The rolling version
  PR is opened with the workflow's own `GITHUB_TOKEN`, so its CI run needs one
  approval click per release and each repo allows GitHub Actions to create pull
  requests; a GitHub App token is a later, separate decision.
- [Why a kit of packages and actions](why-a-kit.md) - Shared tooling ships as
  published `@jjloneman/kit-*` npm packages plus composite GitHub Actions that
  each repo depends on and pins; not a template repo, whose copies drift, or a
  central runner, which leaves repos unable to run their own checks.
- [Why decisions and references are two OKF bundles](okf-bundles.md) - Why the
  kit works the way it does lives in `docs/decisions/` (`type: Decision`), and
  how it's built and consumed lives in `docs/references/` (`type: Reference`),
  as two Open Knowledge Format v0.2 bundles that agents draft and the owner
  signs off with okf-tools' `okf-verify`.
- [Why each package is versioned on its own](independent-versions.md) - Each
  package has its own SemVer version, changelog and `<name>@<version>` tag, with
  no Changesets `fixed` or `linked` groups, so a breaking change in one package
  never forces a major release of the others.
- [Why empty changesets don't block a publish](publish-past-empty-changesets.md) -
  `pack-release` publishes whenever no releasing changeset is pending and
  `changeset publish-plan` lists a version npm or the git tags lack, empty
  changesets or not, so a release never waits on the next version PR's merge;
  `changesets/action/publish` never reads the pending changesets.
- [Why every PR adds a changeset](changeset-every-pr.md) - CI's required
  `🦋 Changeset` check fails a PR whose `changeset status --output` lists no
  changeset, since `changeset status` alone passes any PR that changes no
  package; a PR that ships nothing adds `pnpm changeset --empty`.
- [Why git hooks ship as a package](git-hooks-package.md) - Hook logic ships in
  `kit-git-hooks` as the `kit-pre-commit` and `kit-pre-push` commands, written
  in tested TypeScript, so each repo's hook file is one line that runs them; not
  a shell script copied into every repo.
- [Why the kit supports Node 26 only](node-26-only.md) - Every package declares
  `engines.node >=26`, and CI runs Node 26 alone with no version matrix; a
  consumer whose own published code supports older Node keeps that support, but
  runs its tooling, the kit included, on Node 26.
- [Why the release builds without write access](unprivileged-release-build.md) -
  `release.yml` builds and packs in a job with `contents: read` alone, through
  `pack-release` and `changesets/action/pack`, and only a second job, which
  installs but never builds, holds `contents: write`, `pull-requests: write` and
  `id-token: write` to open the version PR or publish the packed tarballs.

# About this bundle

- This directory is an
  [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
  bundle of jj-kit's design decisions.
- One Markdown file per decision, listed above as
  `- [Title](file.md) - one-sentence description`, sorted by title.
- How the kit is built and consumed lives in the sibling
  [references bundle](../references/index.md).

## Frontmatter

```yaml
---
type: Decision
title: Why each package is versioned on its own
description: Each package has its own SemVer version and changelog.
tags:
  - changesets
  - releases
  - semver
sources:
  - id: changesets-config
    resource: https://github.com/changesets/changesets/blob/main/docs/config-file-options.md
    title: Changesets, config file options
status: stable
generated: { by: claude-code/<model-id>, at: 2026-11-25T12:00:00Z }
verified: { by: human:jjloneman, at: 2026-11-25T13:00:00Z }
---
```

- **`type`**: always `Decision`.
- **`description`**: one sentence, the same text as the record's line above.
- **`tags`**: every specific subject the record covers, usually 5 to 10, from
  the vocabulary below (see [How a record's tags are laid out](tags-layout.md)).
  - A YAML block list right after `description`, one `- tag` per line.
  - Lowercase kebab-case, sorted alphabetically.
  - Add a tag to the vocabulary before a record uses it.
- **`sources`**: the external material a decision rests on, such as a tool's
  docs, when there is any.
  - The body cites each one with a footnote keyed to its `id`.
- **`status`**: the decision's lifecycle:
  - `draft`: written or changed, not yet signed off;
  - `stable`: in force;
  - `deprecated`: superseded, kept for links and history.
- **`generated`**: who wrote the current text, and when.
  - `by` is `<producer>/<version>` for an agent, such as
    `claude-code/<model-id>`, or `human:<id>` for a person.
  - `at` is read from `date -u +%Y-%m-%dT%H:%M:%SZ` when written, never made up.
- **`verified`**: who signed the record off, and when, added only by
  `pnpm okf:verify`.
  - Absent means unreviewed.
  - `human:jjloneman` means the owner signed it off: change the behavior it
    describes only with their agreement.

## Body

- `# Title`, then bullets on the problem the decision answers.
- `## Decision`, dated "as of" the day it was checked, with each rejected option
  as a `**Rejected:**` bullet under the choice it lost to.
- `## Why`, `## Consequences`, and `## Links` to the issues and PRs.
- Footnotes keyed to `sources` ids.

## Tag vocabulary

- `actions`: The kit's composite GitHub Actions.
- `agents`: How coding agents draft, read and update records.
- `approvals`: Runs and PRs that wait for someone to approve them.
- `attw`: Are the Types Wrong, which checks a package's published types.
- `build`: How packages are built into `dist/`.
- `bundler`: Code a bundler builds, and the settings for it.
- `bundles`: OKF bundles and how they're laid out.
- `catalog`: pnpm's `catalog` of shared dependency versions.
- `changelog`: Each package's `CHANGELOG.md`.
- `changesets`: Changeset files, their config, and the `changeset` commands.
- `ci`: CI jobs and required checks.
- `commits`: Commit subjects and the conventions they follow.
- `compiler-options`: TypeScript compiler options.
- `consumers`: Repos that install the kit's packages or use its actions.
- `decisions`: The decisions bundle itself.
- `devengines`: The root's `devEngines` runtime guard.
- `dogfooding`: jj-kit using its own packages and actions.
- `drift`: Copies of shared config that diverge across repos.
- `engines`: A package's `engines` field.
- `formatting`: How formatters such as Prettier treat files.
- `frontmatter`: A record's YAML frontmatter.
- `git`: How the kit runs git and reads its output.
- `git-hooks`: The `pre-commit` and `pre-push` hooks.
- `git-tags`: The git tags a release makes.
- `github-actions`: Workflows, their tokens, and how their runs start.
- `github-app`: A GitHub App and the tokens it issues.
- `github-token`: The workflow's own `GITHUB_TOKEN`.
- `gitmoji`: The emoji after a commit subject's colon.
- `kit-changesets-changelog`: The `@jjloneman/kit-changesets-changelog` package.
- `kit-git-hooks`: The `@jjloneman/kit-git-hooks` package.
- `kit-tsconfig`: The `@jjloneman/kit-tsconfig` package.
- `libraries`: Published library code and its settings.
- `markdown`: Markdown files and how they're laid out.
- `modules`: Module formats and how imports resolve.
- `monorepo`: How the repo holds several packages.
- `naming`: Names of the repo, its packages and its actions.
- `node`: Node.js versions and features the kit relies on.
- `npm`: The npm registry and package metadata.
- `npm-scope`: The `@jjloneman` npm scope.
- `okf`: The Open Knowledge Format.
- `okf-tools`: okf-tools and its `okf-verify` command.
- `packages`: The kit's npm packages as a set.
- `peer-dependencies`: A package's `peerDependencies` and their ranges.
- `permissions`: Workflow and repo permissions.
- `pinning`: How a consumer pins a package or action version.
- `pnpm`: pnpm and its workspace settings.
- `pre-commit`: The pre-commit hook.
- `pre-push`: The pre-push hook.
- `prettier`: Prettier and its settings.
- `publint`: publint, which checks a package's `package.json` and files.
- `pull-requests`: What every pull request must carry.
- `references`: The references bundle.
- `releases`: Versioning and publishing.
- `renovate`: Renovate's dependency updates.
- `rulesets`: The branch rules that protect `main`.
- `runners`: The GitHub Actions runners a job runs on.
- `semver`: Semantic versioning and what counts as breaking.
- `setup-action`: The action that installs pnpm, Node and dependencies.
- `shell`: Shell scripts and running commands through a shell.
- `status`: A record's `status` lifecycle.
- `supply-chain`: What third-party code can reach, and with which credentials.
- `tags`: How a record's `tags` are written.
- `testing`: Tests and the coverage gate.
- `tsdown`: tsdown, which builds each package.
- `type-stripping`: Node running TypeScript by stripping its types.
- `typescript`: TypeScript and its versions.
- `verification`: Who signs a record off, and what that means.
- `version-pr`: The rolling `chore(release): 🚀 version packages` PR.
- `workspace`: The pnpm workspace and `workspace:*` dependencies.
- `yaml`: YAML layout and parsing.
