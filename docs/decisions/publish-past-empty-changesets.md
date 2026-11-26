---
type: Decision
title: Why empty changesets don't block a publish
description:
  "`pack-release` publishes whenever no releasing changeset is pending and
  `changeset publish-plan` lists a version npm or the git tags lack, empty
  changesets or not, so a release never waits on the next version PR's merge;
  `changesets/action/publish` never reads the pending changesets."
tags:
  - actions
  - changesets
  - ci
  - github-actions
  - npm
  - releases
  - version-pr
sources:
  - id: changesets-action
    resource: https://github.com/changesets/action/blob/v2.1.2/src/index.ts
    title: changesets/action v2.1.2, src/index.ts
  - id: changesets-action-publish
    resource: https://github.com/changesets/action/blob/v2.1.2/src/publish/index.ts
    title: changesets/action v2.1.2, src/publish/index.ts
  - id: changesets-action-select-mode
    resource: https://github.com/changesets/action/blob/v2.1.2/src/select-mode/index.ts
    title: changesets/action v2.1.2, src/select-mode/index.ts
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-26T22:22:22Z }
verified: { by: human:jjloneman, at: 2026-11-26T22:42:26Z }
---

# Why empty changesets don't block a publish

- `changesets/action` publishes only when no changeset is pending; while every
  pending one is empty, it logs "All changesets are empty" and does
  nothing[^changesets-action].
  - Its `select-mode` sub-action, built for split jobs, answers `none` in the
    same case[^changesets-action-select-mode].
- So a version PR's merge published nothing when an empty changeset reached
  `main` just before it.
- A release run that a newer push cancelled didn't come back either, while the
  newer run had an empty changeset pending; both cases needed a manual "Run
  workflow" or the next version PR's merge.

## Decision

- **As of 2026-11-26,** from `actions/pack-release/`,
  `actions/version-or-release/action.yml` and `.github/workflows/release.yml`.
- **`pack-release` decides, in the unprivileged job** (see
  [Why the release builds without write access](unprivileged-release-build.md)):
  - a releasing changeset pending → `version`, since the version PR comes first;
  - otherwise, empty changesets or none, it runs `changeset publish-plan` and
    publishes what it lists → `publish`;
  - an empty plan → `none`, so a docs-only merge builds nothing (#5's review);
  - judged by `changeset status --output` and `changeset publish-plan --output`,
    so `ignore`, `privatePackages.tag`, private packages and a monorepo's root
    are Changesets' own answer.
  - **Rejected: `changesets/action/select-mode`,** which answers `none` while
    only empty changesets are pending, the gap this record closes.
- **`changesets/action/publish` publishes the pack without reading the pending
  changesets**, so the empty ones stay on `main` untouched, and the next version
  PR deletes them as usual[^changesets-action-publish].
  - **Rejected: deleting the empty changesets from the run's checkout** before
    the main `changesets/action`, as #5 had it, which `version-or-release` did
    in TypeScript; the publish sub-action needs no such step (#23).
  - **Rejected: running the publish script in a step of its own.** The
    sub-action's own publish path also pushes the tags and creates the GitHub
    releases, which a separate step would have to repeat.
- **It holds back each entry at `0.0.0`**, which no version PR has bumped yet: a
  public package, or a private one while `privatePackages.tag` is on.
  - So a new package or action added with only an empty changeset isn't
    published or tagged at `0.0.0` (#5's review).
  - **Each entry that depends on a held one is held too**, directly or not,
    through its `dependencies`, `optionalDependencies` or `peerDependencies`, or
    it would publish needing a version that was never released (#23's review).
  - The rest of the plan still publishes, and `changesets/action/pack` packs
    from that checked plan, passed as an artifact, so a stray package at `0.0.0`
    never blocks another's release (#23's review).
  - **Rejected: doing nothing while any entry is at `0.0.0`,** which on a
    version PR's merge would hold back every package it bumped (#23's review).
  - The run shows a notice naming each, so a held-back publish isn't silent
    (#5's review).
  - **Rejected: rebuilding Changesets' rules from `pnpm -r ls`** and the config,
    as #5 had it, which #5's reviews kept finding corners of (#23).
- **When it can't read the changesets or the plan, it fails** rather than guess,
  since a wrong `none` would skip a release without a word (#23).
  - So does `@changesets/cli` older than 3, or a plan in a format other than
    `version: 1`, since `publish-plan --output` is experimental as of 3.0.3 (see
    [What the actions require of a consumer](action-requirements.md)).
  - **Rejected: warning and running as if the step weren't there,** as #5 had
    it, which made sense only while the step merely deleted files in front of
    `changesets/action`.
  - `changeset status` without `--since` diffs against `baseBranch`, which a
    detached checkout or another release branch may not have (#5's review).
- The decision is TypeScript, tested at 100% like `require-changeset`'s.

## Why

- A release should never hang on an unrelated docs PR's empty changeset.
- The review of #12 asked for `version-or-release` to publish whenever npm lacks
  a version, not only when no changesets are pending (#5).
- Asking Changesets for its publish plan, rather than copying its rules, keeps
  the answer right as Changesets changes (#23).

## Consequences

- A dropped release publishes on the next push to `main` with no releasing
  changeset pending; "Run workflow" is only for publishing sooner.
- A run with nothing to publish or tag asks the registry once per public package
  and builds nothing.
- **A publish that keeps failing fails the release run on every push to `main`
  with no releasing changeset pending**, not just once, until someone fixes it.
  - The usual cause is a new package's first version, published before its
    trusted publisher is set up.
  - The owner chose to keep this on 2026-11-26, in #5: a red run is the signal
    that a version is waiting, and it stops once that version publishes.
  - **Rejected: retrying only on the version PR's merge commit,** which brings
    back the cancelled run this exists to recover.
  - **Rejected: letting a retried publish fail without failing the job,** which
    would hide real publish failures.
  - **Rejected: skipping packages npm has never seen,** an npm lookup per
    package for a rare case; it fits the `publish-plan` follow-up if the noise
    bites.
    - `publish-plan` now makes that lookup on every run anyway (#23).

## Links

- #12, whose review raised it.
- #5, which settled it.
- #23, which moved it onto Changesets' publish plan and sub-actions.

[^changesets-action]:
    `changesets/action` v2.1.2 publishes when no changeset is pending, opens the
    version PR when a releasing one is, and otherwise does nothing.

[^changesets-action-select-mode]:
    `select-mode` v2.1.2 returns `version` for a releasing changeset, `none` for
    only empty ones, and otherwise `publish` when `publish-plan` lists anything.

[^changesets-action-publish]:
    `publish` v2.1.2 downloads the pack artifact and runs
    `changeset publish --from-pack-dir`, then pushes the tags and creates the
    releases, with no check of `.changeset/`.
