---
okf_version: "0.2"
---

# References

- [Architecture](architecture.md) - How jj-kit is laid out, which packages and
  actions it ships and what each depends on, and how a changeset becomes an npm
  release and a git tag.
- [Consuming the kit](consuming.md) - How a repo installs and wires each kit
  package and action, pins actions by SHA with a version comment that the kit's
  Renovate preset updates, and excludes the kit from its own dependency
  moratorium.

# About this bundle

- This directory is an
  [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
  bundle of reference pages: how jj-kit is built and how a repo consumes it.
- Listed above as `- [Title](file.md) - one-sentence description`, sorted by
  title.
- Why the kit works the way it does is in the sibling
  [decisions bundle](../decisions/index.md), whose frontmatter rules these pages
  follow, with `type: Reference`.
- **Each package or action PR updates these pages** in the same PR as its
  change.

## Tag vocabulary

- `actions`: The kit's composite GitHub Actions.
- `changelog`: Each package's `CHANGELOG.md`.
- `changesets`: Changeset files, their config, and the `changeset` commands.
- `ci`: CI jobs and required checks.
- `consumers`: Repos that install the kit's packages or use its actions.
- `dogfooding`: jj-kit using its own packages and actions.
- `git-tags`: The git tags a release makes.
- `kit-changesets-changelog`: The `@jjloneman/kit-changesets-changelog` package.
- `kit-tsconfig`: The `@jjloneman/kit-tsconfig` package.
- `layout`: Where things live in the repo.
- `moratorium`: A repo's minimum release age for new dependency versions.
- `node`: Node.js versions and features the kit relies on.
- `npm`: The npm registry and package metadata.
- `packages`: The kit's npm packages as a set.
- `pinning`: How a consumer pins a package or action version.
- `pull-requests`: What every pull request must carry.
- `releases`: Versioning and publishing.
- `renovate`: Renovate's dependency updates.
- `setup-action`: The action that installs pnpm, Node and dependencies.
- `testing`: Tests and the coverage gate.
- `type-stripping`: Node running TypeScript by stripping its types.
- `version-pr`: The rolling `chore(release): 🚀 version packages` PR.
- `workspace`: The pnpm workspace and `workspace:*` dependencies.
