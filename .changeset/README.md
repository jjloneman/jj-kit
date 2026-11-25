# Changesets

- **Every PR adds or edits a changeset here**, and CI fails a PR that doesn't.
  - The version PR, and a Renovate PR that ships nothing, are exempt; see [AGENTS.md](../AGENTS.md#-ci).
- **A PR that should cut a release runs `pnpm changeset`**, which asks for:
  - the packages it bumps;
  - each bump (`patch`, `minor`, or `major`);
  - the line it adds to each package's `CHANGELOG.md`.
- **A PR that releases nothing runs `pnpm changeset --empty`.**
  - Until the first package lands, `--empty` refuses to run ("No packages found").
  - Write the file by hand instead: a `.changeset/<name>.md` holding only an empty `---` / `---` frontmatter, which is all `--empty` writes.
- See [AGENTS.md](../AGENTS.md#-versioning--releases) for the full release flow.
