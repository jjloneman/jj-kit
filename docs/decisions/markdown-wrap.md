---
type: Decision
title: How Markdown is wrapped
description:
  Prettier wraps Markdown at 80 columns, frontmatter included, through a
  `proseWrap` override for Markdown files only that leaves changesets unwrapped,
  so each summary reaches `CHANGELOG.md` as written.
tags:
  - agents
  - changelog
  - changesets
  - formatting
  - frontmatter
  - kit-prettier-config
  - markdown
  - okf-tools
  - prettier
  - verification
  - yaml
sources:
  - id: prettier-prose-wrap
    resource: https://prettier.io/docs/options#prose-wrap
    title: Prettier options, prose wrap
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-28T08:36:25Z }
verified: { by: human:jjloneman, at: 2026-11-28T08:51:12Z }
---

# How Markdown is wrapped

- Code already wrapped at Prettier's default `printWidth` of 80, but Markdown
  kept each bullet on one line, however long, under the default
  `proseWrap: "preserve"`[^prettier-prose-wrap].
- The owner wants Markdown at 80 too, so files read well side by side in GitHub
  and VS Code, as their other repos' Markdown already does.

## Decision

- **As of 2026-11-25, the root `prettier.config.ts` sets `proseWrap: "always"`
  in an override for `**/*.md`.**
  - `printWidth` stays at its default of 80.
  - **Rejected: setting it at the top level.** `proseWrap` also rewraps YAML's
    folded scalars, so `ci.yml`'s `concurrency.group` and `release.yml`'s
    `run: >-` command were split mid-expression.
- **A record's frontmatter wraps too**, since Prettier formats it as YAML with
  the same options; a long `description` starts on the line after its key.
  - **Rejected: `embeddedLanguageFormatting: "off"` for `*.md`.** It keeps
    frontmatter on one line, but also stops Prettier formatting code blocks
    inside Markdown.
- **Changesets (`.changeset/*.md`) are excluded**, so a summary written on one
  line reaches `CHANGELOG.md` as one line.
  - `.changeset/README.md` is an ordinary doc, so it still wraps.
- **Agents still write each bullet as one line** and let `pnpm format` wrap it,
  as AGENTS.md says.
- **Tables, URLs and inline code in the body can't wrap**, so those lines may
  run past 80.
  - In frontmatter, Prettier may split inline code across lines.
- **The reflow left every record's `verified` stamp alone**, since it changed
  only line breaks, not wording.
  - `okf-verify` compares `generated.at` with `verified.at`, so the records
    still read as verified.

## Why

- One width for code and prose keeps every file readable in a split view.
- Wrapping frontmatter keeps code blocks in records formatted, which matters
  more than a one-line `description`.
- A changeset summary becomes a changelog line, and #4's changelog formatter
  prefixes each line, so a hard-wrapped summary would split one entry.

## Consequences

- `grep '^description:'` no longer shows a record's description when it wraps;
  read the frontmatter instead, as for `tags` (see
  [How a record's tags are laid out](tags-layout.md)).
- Each bundle's index entries wrap over several lines too.
- A ` ```yaml ` code block in Markdown is formatted with the same options, so a
  long folded scalar in a snippet, such as a `run: >-` command, is rewrapped;
  the command means the same, since folding joins lines with a space.
- A footnote too long for its label's line moves to the next line, indented;
  GitHub renders it the same.
- **As of 2026-11-28, jj-kit keeps this override on top of the shared base**:
  its `prettier.config.ts` spreads `kit-prettier-config` and adds it, since the
  owner's repos wrap different Markdown, so the base leaves `proseWrap` out (#7;
  see [What the shared Prettier config holds](prettier-config.md)).

## Links

- #17, which made the change.
- #7, which kept it on top of the shared Prettier config.

[^prettier-prose-wrap]:
    Prettier's `proseWrap` defaults to `"preserve"`, which leaves Markdown line
    breaks as written; `"always"` wraps prose at `printWidth`.
