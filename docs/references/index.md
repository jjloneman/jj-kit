---
okf_version: "0.2"
---

# References

- [Architecture](architecture.md) - How jj-kit is laid out, which packages and
  actions it ships and what each depends on, and how a changeset becomes an npm
  release and a git tag.
- [Consuming the kit](consuming.md) - How a repo installs and wires each kit
  package and action, pins actions by SHA with a version comment, and excludes
  `@jjloneman/*` from its own dependency moratorium.

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
- `ci`: CI jobs and required checks.
- `consumers`: Repos that install the kit's packages or use its actions.
- `layout`: Where things live in the repo.
- `moratorium`: A repo's minimum release age for new dependency versions.
- `packages`: The kit's npm packages as a set.
- `pinning`: How a consumer pins a package or action version.
- `releases`: Versioning and publishing.
- `renovate`: Renovate's dependency updates.
