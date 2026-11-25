---
type: Decision
title: How a record's tags are laid out
description: A record's `tags` are a YAML block list, one `- tag` per line, sorted alphabetically, naming every specific subject the record covers, each from the bundle's tag vocabulary; not a one-line flow list.
tags:
  - formatting
  - frontmatter
  - okf
  - prettier
  - tags
  - yaml
sources:
  - id: okf-tools-tags-layout
    resource: https://github.com/jjloneman/okf-tools/blob/main/docs/decisions/tags-layout.md
    title: okf-tools, How a record's tags are laid out
  - id: prettier-print-width
    resource: https://prettier.io/docs/options#print-width
    title: Prettier options, print width
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-25T17:54:10Z }
verified: { by: human:jjloneman, at: 2026-11-25T18:26:03Z }
---

# How a record's tags are laid out

- Tags are how an agent finds the records that bear on a change, so a record with too few, or tags no one can grep, goes unread.
- OKF records often keep `tags` as a one-line flow list, `tags: [ci, releases]`, which Prettier rewraps once the line passes 80 columns[^prettier-print-width].

## Decision

- **As of 2026-11-25, in both of this repo's bundles.**
- **`tags` is a YAML block list**, right after `description`, one `- tag` per line:

  ```yaml
  tags:
    - changesets
    - ci
    - releases
  ```

  - **Rejected: a one-line flow list** (`[a, b]`). Prettier breaks a long one into one bracket and one tag per line, so a record's layout would flip once its list crosses 80 columns.
  - **Rejected: a wider Prettier `printWidth` for Markdown,** which would only move the cap, and would also rewrap code in record bodies.

- **Tags are sorted alphabetically**, lowercase kebab-case.
- **Tags are comprehensive:** every specific subject the record covers (a tool, a file, a setting, a workflow), not only its area.
  - A record usually has 5 to 10.
- **Every tag comes from its bundle's tag vocabulary**, in the bundle's `index.md`.
  - A new tag is added to the vocabulary, with a one-line meaning, before a record uses it.

## Why

- A block list holds at any length with no Prettier config, and diffs one tag per line.
- okf-tools reached the same layout for its own bundle[^okf-tools-tags-layout]; the owner chose it here, and asked for every subject to be tagged, on #3.
- Sorted tags make a missing or duplicate one easy to spot in review.

## Consequences

- `grep '^tags:'` no longer shows a record's tags; read them from the frontmatter instead.
- `changeset-every-pr.md`, which #12 wrote with a flow list, moved to the block layout here, so it went back to `status: draft` for the owner to sign off again.
- A change to a record's subjects updates its tags in the same PR, and its index line if the description changes.

## Links

- #3, which chose the layout.

[^okf-tools-tags-layout]: okf-tools recommends a block list for `tags`, since Prettier rewraps a long flow list.

[^prettier-print-width]: Prettier's `printWidth` defaults to 80, the line length it wraps at.
