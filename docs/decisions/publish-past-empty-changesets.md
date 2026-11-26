---
type: Decision
title: Why empty changesets don't block a publish
description:
  "`version-or-release` sets aside the pending changesets for one run when every
  one of them is empty, so `changesets/action` takes its publish path and
  publishes any version npm doesn't have yet, rather than waiting for the next
  version PR's merge."
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
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-26T04:26:32Z }
---

# Why empty changesets don't block a publish

- `changesets/action` publishes only when no changeset is pending; while every
  pending one is empty, it logs "All changesets are empty" and does
  nothing[^changesets-action].
- So a version PR's merge published nothing when an empty changeset reached
  `main` just before it.
- A release run that a newer push cancelled didn't come back either, while the
  newer run had an empty changeset pending; both cases needed a manual "Run
  workflow" or the next version PR's merge.

## Decision

- **As of 2026-11-26,** from `actions/version-or-release/action.yml` and its
  `src/set-aside.ts`.
- **When every pending changeset is empty, the action deletes them from that
  run's checkout** before `changesets/action` runs, judged by
  `changeset status --output`.
  - Nothing is committed: the files stay on `main`, and the next version PR
    deletes them as usual.
  - `changesets/action` then takes its publish path, and `changeset publish`
    publishes every version npm doesn't have yet, so a run with nothing to
    publish is a no-op.
  - It never runs while a changeset releases something, since the version PR
    comes first.
  - **It never runs while a package the publish would release is at `0.0.0`**,
    which no version PR has bumped yet: a public package, or a private one while
    `privatePackages.tag` is on.
    - So a new package or action added with only an empty changeset isn't
      published or tagged at `0.0.0` (#5's review).
    - A monorepo's root, and a package the config's `ignore` names, are left
      out, since Changesets never releases them.
    - The run shows a notice naming the package, so a held-back publish isn't
      silent (#5's review).
  - **When it can't read the changesets or the workspace's packages, it warns
    and leaves them alone**, so `changesets/action` runs as it would without it.
    - Only `@changesets/cli` older than 3, or a failure to delete a changeset,
      fails the step; a half-deleted set would publish or version from a state
      no one chose (see
      [What the actions require of a consumer](action-requirements.md)).
    - `changeset status` without `--since` diffs against `baseBranch`, which a
      detached checkout or another release branch may not have (#5's review).
  - The decision is TypeScript, tested at 100% like `require-changeset`'s.
  - **Rejected: running the publish script in a step of its own** after
    `changesets/action`. The action's own publish path also pushes the tags and
    creates the GitHub releases, which a separate step would have to repeat.
- **It runs only when `publish-script` is set**, since a repo that never
  publishes has nothing to catch up on.

## Why

- A release should never hang on an unrelated docs PR's empty changeset.
- The review of #12 asked for `version-or-release` to publish whenever npm lacks
  a version, not only when no changesets are pending (#5).

## Consequences

- A dropped release publishes on the next push to `main` with no releasing
  changeset pending; "Run workflow" is only for publishing sooner.
- Every run on `main` with only empty changesets pending runs the publish
  script, build included, even when nothing is unpublished; gating it on
  `changeset publish-plan` is left for later (#5's review).
- **A publish that keeps failing fails the release run on every push to `main`
  with only empty changesets pending**, not just once, until someone fixes it.
  - The usual cause is a new package's first version, published before its
    trusted publisher is set up.
  - The owner chose to keep this on 2026-11-26, in #5: a red run is the signal
    that a version is waiting, and it stops once that version publishes.
  - **Rejected: retrying only on the version PR's merge commit,** which brings
    back the cancelled run this exists to recover.
  - **Rejected: letting a retried publish fail without failing the job,** which
    would hide real publish failures, since `changesets/action` publishes inside
    its own step.
  - **Rejected: skipping packages npm has never seen,** an npm lookup per
    package for a rare case; it fits the `publish-plan` follow-up if the noise
    bites.

## Links

- #12, whose review raised it.
- #5, which settled it.

[^changesets-action]:
    `changesets/action` v2.1.2 publishes when no changeset is pending, opens the
    version PR when a releasing one is, and otherwise does nothing.
