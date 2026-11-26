---
type: Decision
title: Why every PR adds a changeset
description:
  CI's required `🦋 Changeset` check fails a PR whose `changeset status
  --output` lists no changeset, since `changeset status` alone passes any PR
  that changes no package; a PR that ships nothing adds `pnpm changeset
  --empty`.
tags:
  - actions
  - changesets
  - ci
  - pull-requests
  - releases
  - renovate
  - rulesets
  - version-pr
sources:
  - id: changesets-empty
    resource: https://github.com/changesets/changesets/blob/main/docs/command-line-options.md
    title: Changesets, command line options
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-26T04:26:32Z }
verified: { by: human:jjloneman, at: 2026-11-26T18:24:07Z }
---

# Why every PR adds a changeset

- Releases come from changeset files, not commit messages.
- So a PR that forgets one changes a package without ever releasing the change.

## Decision

- **As of 2026-11-26,** from `.github/workflows/ci.yml`,
  `actions/require-changeset/` and `.github/rulesets/main.json`.
- **Every PR adds a changeset:**
  - `pnpm changeset` when it changes what a package ships, naming each package
    it bumps;
  - `pnpm changeset --empty` when it only touches tooling, tests, or docs, which
    records no release[^changesets-empty].
- **CI's `🦋 Changeset` job enforces it** through the kit's own
  `require-changeset` action, which runs
  `changeset status --since=<base> --output=<file>` and fails when the file's
  `changesets` list is empty.
  - The list holds the changesets the PR added or edited, read by changesets'
    own rules, so a file changesets ignores (`.changeset/drafts/x.md`,
    `CLAUDE.md`) doesn't count, and an empty changeset does.
  - **Rejected: a `git diff` for any added `.changeset/*.md`.** It counted files
    changesets ignores, and missed an edited or renamed pending changeset (#12's
    review).
  - **Rejected: `pnpm changeset status --since=origin/main` alone,** as
    okf-tools has it. It fails only when a versionable package changed and no
    changeset exists, so in this monorepo it passes every PR that touches only
    root files, and every PR before the first package lands.
- **It skips the version PR (`changeset-release/main`) from this repo,** which
  only consumes changesets, when its author is in the action's
  `version-pr-authors` input, `github-actions[bot]` by default; a fork's or a
  person's branch of that name is still checked.
  - **In jj-kit, `ci.yml` also skips the whole job for the version PR**, by
    repo, branch and `github-actions[bot]`, so the version PR needs no checkout
    or install; a skipped required job counts as passing.
    - The job's condition repeats `version-pr-authors` with fixed values, and a
      comment above it says to change the two together.
    - If they drift, the action still skips the version PR, so the only cost is
      that install; drift can't let a missing changeset through.
    - **Rejected: dropping the job-level skip,** which pays a full checkout and
      install on every version PR (#5's review).
    - **Rejected: a separate classify job** that the changeset job depends on,
      which costs an extra runner on every PR, more than the install it saves
      (#5's review).
- **A Renovate PR from this repo skips it only when it ships nothing**, as the
  action decides.
  - It's a Renovate PR when its branch matches the action's `renovate-branches`
    input, `renovate/**` by default, and its author is in `renovate-authors`,
    `renovate[bot]` by default.
  - **Rejected: matching the branch name alone,** as #12 had it, which let any
    same-repo branch named `renovate/...` skip the changeset (#12's review); the
    version PR is matched by author too (#5's review).
  - **A package is versioned** by Changesets' own rules: it has a name and a
    version, isn't in the config's `ignore`, and is public, or private while
    `privatePackages.version` is on, as jj-kit's is, so its actions count.
    - A package the PR deletes ships nothing, since no changeset can name it.
    - Workspace packages are found as pnpm finds them, skipping `node_modules`
      and `bower_components` folders.
  - **A versioned package ships a change** when its `dependencies`,
    `optionalDependencies`, `peerDependencies`, `engines` or entry-point fields
    (`exports`, `main`, `bin`, `files`, `type`, `types` and the like) change, a
    `catalog:` entry they point to included, or when a file it publishes
    changes, such as an action's `action.yml` or a source fix pushed onto the
    branch.
    - A file is published when the package's `files` list includes it, dotfiles
      included, or npm packs it anyway (a top-level README or license, the
      `main` or a `bin` target), or, with no `files` list, always; an empty
      `files: []` publishes only what npm packs anyway.
    - **Any other file in a versioned package needs a changeset**, an empty one
      included, as on any PR: a build input such as `tsconfig.json` can change
      what ships even outside `files`, so the owner decides.
      - **Rejected: treating files outside `files` as shipping nothing,** which
        let a build-config change that alters `dist/` merge with no changeset
        (#5's review).
    - Then it needs a changeset that releases each such package, which the owner
      adds to its branch; an empty one, one naming the package with `none`, or
      one releasing another package doesn't count.
    - **Rejected: judging by the manifests alone,** which let a Renovate bump of
      an action's `uses:` line merge without releasing the action (#5's review).
    - **Rejected: accepting any changeset for a non-manifest change,** which let
      an empty one through (#5's review).
  - A dev dependency, an unversioned private package's change, or a monorepo
    root's bump needs no release, since nothing published changes; an
    unversioned private package's other files still need some changeset.
  - **In a single-package repo, the root is the package**, judged the same way:
    a published root file needs a release when the root is versioned, and any
    other root file but the lockfile, workspace file and `.github/` needs a
    changeset.
    - A workspace file that lists package globs makes the repo a monorepo, as
      Changesets decides, even before a package matches them.
  - The actions need `@changesets/cli` 3 or later, whose `privatePackages`
    defaults they read (see
    [What the actions require of a consumer](action-requirements.md)).
  - The action fails rather than answer "ships nothing" when it can't tell, so a
    broken check never skips a changeset.
  - **Rejected: skipping every Renovate PR,** as #12's plan first had it: a
    runtime dependency bump would merge without a release, so consumers would
    never get it (#12's review).
  - **Rejected: comparing only the manifests' dependency fields,** since a
    `catalog:` bump in `pnpm-workspace.yaml` changes a package's published
    dependency without touching its manifest (#12's review).
- **Every `ci.yml` job is a required check on `main`,** so the changeset job
  blocks a merge rather than just showing red.

## Why

- The question "does this release?" gets answered on every PR, rather than by
  remembering to.
- An empty changeset makes "nothing ships" an explicit answer, which the check
  can tell from a forgotten one.
- The owner chose to check for a changeset explicitly on 2026-11-25, in #12,
  once `changeset status` was found to pass a PR with no changeset here.

## Consequences

- Docs-only and CI-only PRs still add a changeset.
- Every consumer of `require-changeset` gets the same rule, so a repo's check no
  longer drifts from this one.
- A self-hosted Renovate that opens PRs as another login passes it in
  `renovate-authors`, or its PRs are checked like any other.

## Links

- #12, which added the job.
- #5, which moved it into the `require-changeset` action.

[^changesets-empty]: `changeset --empty` adds a changeset that bumps no package.
