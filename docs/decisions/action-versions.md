---
type: Decision
title: How the actions are versioned
description:
  Each action is a private workspace package under `actions/`, which Changesets
  versions, changelogs and tags as `<name>@<version>` with nothing published;
  consumers pin it by SHA with that tag in a comment, and a Renovate preset to
  update those pins is a follow-up.
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
  - id: renovate-github-actions
    resource: https://docs.renovatebot.com/modules/manager/github-actions/
    title: Renovate, the github-actions manager
  - id: renovate-regex
    resource: https://docs.renovatebot.com/modules/manager/regex/
    title: Renovate, the regex custom manager
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-26T19:09:51Z }
verified: { by: human:jjloneman, at: 2026-11-26T18:24:07Z }
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
  - Each action that uses it, `require-changeset` and `version-or-release`,
    depends on it as `workspace:*`, so a release of `lib` also patch-releases
    both, whose behavior it changes.
  - `setup`, which runs no code of its own, doesn't depend on it, so a `lib`
    release leaves it alone.
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
  - **A follow-up adds a Renovate preset to the kit** that turns that manager
    off for `jjloneman/jj-kit` and adds a regex custom manager instead: it
    captures the action's name from the `uses:` line, and its
    `extractVersionTemplate` keeps only that action's tags[^renovate-regex].
  - Whether that manager rewrites both the SHA and the comment in one update is
    not yet checked; the follow-up checks it with a Renovate dry run once the
    first action tags exist.

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
- Until the preset lands, a consumer bumps its action pins by hand.

## Links

- #5, which built the actions and settled this.

[^changesets-config]:
    `privatePackages.version` versions and changelogs private packages, and
    `privatePackages.tag` tags them when publishing.

[^renovate-github-actions]:
    The manager reads a pinned action's version from a comment such as
    `# v1.2.3` or `# tag=v1.2.3`, and keys the dependency by `owner/repo`.

[^renovate-regex]:
    A regex custom manager takes named capture groups and templates such as
    `extractVersionTemplate`, and a release whose tag doesn't match the extract
    pattern is dropped.
