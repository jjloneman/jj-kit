# Changesets

- **Every PR adds or edits a changeset here**, and CI fails a PR that doesn't.
  - The version PR, and a Renovate PR that ships nothing, are exempt; see
    [AGENTS.md](../AGENTS.md#-ci).
- **A PR that should cut a release runs `pnpm changeset`**, which asks for:
  - the packages it bumps;
  - each bump (`patch`, `minor`, or `major`);
  - the line it adds to each package's `CHANGELOG.md`.
- **A PR that releases nothing runs `pnpm changeset --empty`.**
- See [AGENTS.md](../AGENTS.md#-versioning--releases) for the full release flow.
