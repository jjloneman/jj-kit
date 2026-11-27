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
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T02:05:31Z }
verified: { by: human:jjloneman, at: 2026-11-26T18:24:07Z }
---

# Why every PR adds a changeset

- Releases come from changeset files, not commit messages.
- So a PR that forgets one changes a package without ever releasing the change.

## Decision

- **As of 2026-11-27,** from `.github/workflows/ci.yml`,
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
      - A file it leaves behind belongs to the deepest package around it that's
        still there, and is judged as that package's (#27's review).
    - Workspace packages are found as pnpm finds them, skipping `node_modules`
      and `bower_components` folders.
  - **A versioned package ships a change** when its `dependencies`,
    `optionalDependencies`, `peerDependencies`, `engines` or entry-point fields
    (`exports`, `main`, `bin`, `files`, `type`, `types` and the like) change, a
    `catalog:` entry they point to included, or when a file it publishes
    changes, such as an action's `action.yml` or a source fix pushed onto the
    branch.
    - A file is published when
      `pnpm pack --dry-run --json --ignore-scripts --ignore-pnpmfile`, run in
      the package's folder at the PR's head, lists it (#27).
      - Scripts and the `.pnpmfile.cjs` stay off, since on a Renovate PR either
        is the PR's own code; without the flag, pack loads the pnpmfile (checked
        with pnpm 12.22 on 2026-11-27).
      - The check runs before any build, so an unbuilt `dist/` is missing from
        the list; a PR never changes `dist/`, which is gitignored.
      - Only the packages a changed file other than a manifest falls in are
        packed, once each.
      - With `publishConfig.directory`, pnpm packs that folder, listing paths
        relative to it (checked with pnpm 12.22 on 2026-11-27), so a changed
        file is matched under it, and a file outside it isn't published (#27's
        review).
        - A file outside it is decided without packing, since that folder may be
          unbuilt, which makes `pnpm pack` fail (#27's review).
        - A `publishConfig.directory` outside the package, or absolute, can't be
          matched, so every file of the package counts as published (#27's
          review).
      - A changed submodule in a versioned package counts as published, since a
        checkout that skips submodules, as `actions/checkout` does by default,
        leaves `pnpm pack` nothing to list inside it (#27's review).
        - **Rejected: matching the files pnpm packs inside it,** which let a
          bump through with an empty changeset whenever the submodule wasn't
          checked out (#27's review).
      - A failed `pnpm pack` fails the check with pnpm's own error, then the
        pnpm it needs; a warning pnpm prints before or after the JSON is
        skipped.
      - **Rejected: copying npm-packlist's rules by hand** (the `files` list,
        `!` excludes, dotfiles, the README and license npm always packs, the
        `main` and `bin` targets), as #5 had it, since its reviews kept finding
        corners the copy missed (#27).
    - **The manifests and workspace file come from git at both revisions**, read
      in one `git cat-file --batch`, while `pnpm pack` reads the working tree
      (#27).
      - So a symlinked manifest, or a step before this one that edits one, reads
        the same at the head as at the base.
      - **Rejected: reading the head's manifests from the working tree,** as
        #27's plan had it: a symlinked `package.json` then read as JSON at the
        head but as its link target at the base (#27's review).
    - **A file the PR deletes counts as any other file**, needing a changeset
      but no release, since the head's pack list can't say whether it shipped
      (#27).
      - **Rejected: counting it as published,** as #27's plan first had it,
        which made a Renovate config migration that deletes `renovate.json` in a
        single-package repo demand a release (#27's review).
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
    other root file but the lockfile, workspace file, `.changeset/` and
    `.github/` needs a changeset.
    - `.changeset/` ships nothing even when `pnpm pack` lists it, since
      otherwise the empty changeset the owner adds to a Renovate branch would
      itself demand a release (#27's review).
  - **The Changesets config needs a changeset but no release**, in a monorepo or
    a single-package repo, as a build config does, since it changes what
    releases (#27's review).
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
- #27, which judges published files by `pnpm pack`.

[^changesets-empty]: `changeset --empty` adds a changeset that bumps no package.
