---
type: Decision
title: Which token opens the version PR
description: The rolling version PR is opened with the workflow's own `GITHUB_TOKEN`, so its CI run needs one approval click per release and each repo allows GitHub Actions to create pull requests; a GitHub App token is a later, separate decision.
tags:
  - approvals
  - ci
  - github-actions
  - github-app
  - github-token
  - permissions
  - releases
  - version-pr
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T18:25:43Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# Which token opens the version PR

- `release.yml` keeps a rolling `chore(release): 🚀 version packages` PR open, through `changesets/action`.
- When the workflow's own `GITHUB_TOKEN` opens or updates that PR, its CI run is started by `github-actions[bot]` and waits for someone to approve it, as observed on jj-kit's version PRs.

## Decision

- **As of 2026-11-25,** from `.github/workflows/release.yml`.
- **The version PR is opened with `GITHUB_TOKEN`**, under the job's `contents: write` and `pull-requests: write` permissions.
  - Its CI run is started by `github-actions[bot]` and waits for approval; the owner approves it on the PR before merging, since `main` requires every check.
  - Each repo turns on "Allow GitHub Actions to create and approve pull requests" in its Actions settings.
- **A GitHub App token is a later, separate decision.**
  - The kit's `version-or-release` action takes its token as a `github-token` input, so it can take an App token later without a breaking change (#5).
- **Choosing an App token edits this record** in the same PR, which sends it back to `status: draft` for the owner to sign off again.

## Why

- One approval click per release costs little at the kit's release rate.
- `GITHUB_TOKEN` needs no secret to create, store or rotate, in jj-kit or any consumer.

## Consequences

- A release is never fully unattended: someone approves the version PR's CI run before it can merge.
- A consumer that wants no click must set up an App and pass its token, once that path is decided.

## Links

- #12, which added `release.yml`.
- #5, which adds the `version-or-release` action.
- #3, which records this decision.
