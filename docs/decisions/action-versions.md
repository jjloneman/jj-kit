---
type: Decision
title: How the actions are versioned
description:
  Each action is a private workspace package under `actions/`, which Changesets
  versions, changelogs and tags as `<name>@<version>` with nothing published;
  consumers pin it by SHA with that tag in a comment, which the kit's Renovate
  preset keeps up to date.
tags:
  - actions
  - changelog
  - changesets
  - consumers
  - git-tags
  - pinning
  - releases
  - renovate
  - semver
  - setup-action
  - workspace
sources:
  - id: changesets-config
    resource: https://github.com/changesets/changesets/blob/main/docs/config-file-options.md
    title: Changesets, config file options
  - id: renovate-auto-replace
    resource: https://github.com/renovatebot/renovate/blob/44.255.2/lib/workers/repository/update/branch/auto-replace.ts
    title: Renovate, how an update rewrites a matched string
  - id: renovate-github-actions
    resource: https://docs.renovatebot.com/modules/manager/github-actions/
    title: Renovate, the github-actions manager
  - id: renovate-regex
    resource: https://docs.renovatebot.com/modules/manager/regex/
    title: Renovate, the regex custom manager
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T07:13:31Z }
verified: { by: human:jjloneman, at: 2026-11-26T22:42:26Z }
---

# How the actions are versioned

- The kit's composite actions live in one repo beside its npm packages, so they
  can't use a repo-wide `v1` tag the way a single-action repo does.
- A consumer still needs a version to pin, a changelog to read, and a way for
  Renovate to tell it a new version exists.

## Decision

- **As of 2026-11-26,** from `.changeset/config.json`, `pnpm-workspace.yaml` and
  `actions/*/package.json`.
- **Each action is a private workspace package**, `actions/<name>/package.json`,
  named for the action, such as `require-changeset`.
  - `pnpm-workspace.yaml` lists `actions/*` beside `packages/*`.
  - Changesets' `privatePackages` is `{ "tag": true, "version": true }`, so a
    changeset bumps an action, writes its `CHANGELOG.md`, and the release run
    tags it `<name>@<version>`, such as `require-changeset@1.0.0`, with nothing
    published to npm[^changesets-config].
  - Each action versions on its own, like the packages (see
    [Why each package is versioned on its own](independent-versions.md)).
  - **Rejected: one version for every action**, as an `actions` package tagged
    `actions@<version>`. Renovate would need only one rule, but a breaking
    change in one action would be a major for all of them, and the pin's comment
    wouldn't say which action it is.
- **Code the actions share lives in `actions/lib`**, a private package that
  isn't an action, which they import by relative path.
  - Each action that uses it, `pack-release` and `require-changeset`, depends on
    it as `workspace:*`, so a release of `lib` also patch-releases both, whose
    behavior it changes.
  - `setup` and `version-or-release`, which run no code of their own, don't
    depend on it, so a `lib` release leaves them alone (#23).
  - `lib` is tagged `actions-lib@<version>` like the actions, though nothing
    pins it.
  - **Rejected: importing one action's code from the other**, which would change
    the second action without releasing it.
- **A consumer pins each action by full commit SHA, with its tag in a comment:**

  ```yaml
  - uses: jjloneman/jj-kit/actions/require-changeset@<sha> # require-changeset@<version>
  ```

  - **Rejected: pinning to the SHA of `main`**, which Renovate would move to
    every new commit, so consumers would run unreleased changes with no
    changelog.

- **Renovate's built-in `github-actions` manager can't update these pins.**
  - It names every action in the repo by `owner/repo` alone, and reads a
    trailing comment as a version only when it starts with a digit or `v`, so
    `# require-changeset@1.0.0` falls back to tracking that tag's digest
    alone[^renovate-github-actions].
- **The kit ships a Renovate preset instead**, `renovate/actions.json`, which
  consumers extend as `github>jjloneman/jj-kit//renovate/actions` (#24).
  - A `packageRules` entry turns the `github-actions` manager off for
    `jjloneman/jj-kit`, so no line is updated twice.
  - A regex custom manager reads the same files that manager does, and captures
    the action's name from the `uses:` line, the SHA as `currentDigest` and the
    comment's version as `currentValue`.
  - **It reads only `@<sha> # <name>@<x.y.z>` on one line**: a comment on the
    next line, a short version such as `# setup@0`, a `v` prefix, a version with
    text glued to it such as `1.2.3+abc`, or an action name with a dot isn't
    matched, so the pin is left alone rather than rewritten wrongly.
    - A short version would also corrupt the SHA, since Renovate replaces every
      copy of `currentValue` in the matched string.
    - A pin the regex skips gets no updates at all, since the built-in manager
      is off for every kit pin; `consuming.md` says so.
    - The comment's name isn't checked against the action in the path, since
      Renovate's regex engine, RE2, has no backreferences; the tags come from
      the path's action, so a mislabeled comment gets that action's version.
  - It gives each update the dep type `action`, as the built-in manager does, so
    a consumer's `matchDepTypes` rules still apply.
  - It looks up `github-tags` on `jjloneman/jj-kit`, and its
    `extractVersionTemplate`, `^{{{action}}}@(?<version>.+)$`, keeps only that
    action's tags[^renovate-regex].
  - **One update rewrites both the SHA and the comment**, with no
    `autoReplaceStringTemplate`: Renovate replaces the version, then the digest,
    inside the matched string, then re-reads the file to confirm
    both[^renovate-auto-replace].
    - Checked on 2026-11-27 with Renovate 44.255.2: a dry run against a scratch
      consumer pinning `version-or-release@0.1.0` found `0.2.0` with the commit
      that tag points to, and its own replace step wrote
      `@5011da8… # version-or-release@0.2.0`.
  - **The preset is read from `main`, unversioned**, so a change to it reaches
    every consumer at once, and its PR takes an empty changeset.

## Why

- A private package reuses the release flow the npm packages already have, so an
  action needs no versioning tool of its own.
- A SHA pin can't move under a consumer, and the comment keeps the version
  readable in review.
- The owner chose per-action tags with the preset as a follow-up on 2026-11-26,
  in #5, since no repo consumes the actions yet and the preset can only be
  tested against real action tags.

## Consequences

- Each action PR adds a changeset that names the action, like any package PR.
- An action's `package.json` holds only what versioning and its own tests need;
  its `action.yml` is what consumers run.
- A consumer extends the preset once, and gets one Renovate PR per action
  release.

## Links

- #5, which built the actions and settled this.
- #23, which added `pack-release` and left `version-or-release` with no code.
- #24, which added the Renovate preset.

[^changesets-config]:
    `privatePackages.version` versions and changelogs private packages, and
    `privatePackages.tag` tags them when publishing.

[^renovate-auto-replace]:
    With no `autoReplaceStringTemplate`, the update replaces `currentValue` with
    `newValue`, then `currentDigest` with `newDigest`, in the matched string,
    and keeps the result only if the file still extracts with both.

[^renovate-github-actions]:
    The manager reads a pinned action's version from a comment such as
    `# v1.2.3` or `# tag=v1.2.3`, and keys the dependency by `owner/repo`.

[^renovate-regex]:
    A regex custom manager takes named capture groups and templates such as
    `extractVersionTemplate`, and a release whose tag doesn't match the extract
    pattern is dropped.
