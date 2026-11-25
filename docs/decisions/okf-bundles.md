---
type: Decision
title: Why decisions and references are two OKF bundles
description: "Why the kit works the way it does lives in `docs/decisions/` (`type: Decision`), and how it's built and consumed lives in `docs/references/` (`type: Reference`), as two Open Knowledge Format v0.2 bundles that agents draft and the owner signs off with okf-tools' `okf-verify`."
tags:
  - agents
  - bundles
  - decisions
  - okf
  - okf-tools
  - references
  - status
  - verification
sources:
  - id: okf-spec
    resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
    title: Open Knowledge Format specification
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T18:01:48Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# Why decisions and references are two OKF bundles

- The kit's design choices need writing down, so a later change, by a person or an agent, can check itself against them.

## Decision

- **As of 2026-11-25,** from `package.json`'s `okf` block.
- **Two Open Knowledge Format v0.2 bundles**[^okf-spec]:
  - `docs/decisions/`, one `type: Decision` record per choice, saying why;
  - `docs/references/`, `type: Reference` pages saying how the kit is built and how a repo consumes it.
- **Each bundle lists its records in its `index.md`**, sorted by title, with its frontmatter shape and tag vocabulary.
- **Records are signed off with okf-tools' `okf-verify`**, configured by `okf.bundles` and `okf.verifiedBy: human:jjloneman`, and run as `pnpm okf:verify`.
- **An agent drafts a record as `status: draft`** and records itself in `generated`; it never adds a `verified` entry on its own.
- **A record is updated in the same PR as the behavior it describes**, re-stamping `generated`, so a signed-off record shows as changed until the owner verifies it again.

## Why

- A decision record holds the reasons and rejected options that code and commits don't.
- No thread records why two bundles rather than one; the drafter's reading, for the owner to confirm at sign-off:
  - references change with every package, while decisions change only when a choice is revisited;
  - so keeping them apart keeps a decision's sign-off from going stale with each package PR.
- okf-tools is the owner's own tool for this, already used in okf-tools itself.

## Consequences

- Each package or action PR, #4 to #11, updates `architecture.md` and `consuming.md` in the same PR as its change.
- `docs/` is outside every package's `files`, so the bundles never ship to npm.

## Links

- #12, which added okf-tools and the `okf` config.
- #3, which records this decision.

[^okf-spec]: OKF v0.2 defines a bundle as a folder of Markdown records with YAML frontmatter, listed in an `index.md`.
