# require-changeset

## 0.2.0

### Minor Changes

- 🏗️ **require-changeset:** A Renovate PR now needs pnpm 10.26 or later: the check asks `pnpm pack --dry-run --ignore-scripts --ignore-pnpmfile` which files each package publishes, instead of copying npm's packing rules. (81787c8)

### Patch Changes

- 🏗️ **require-changeset:** Read both revisions' manifests, workspace file and Changesets config through one `git cat-file --batch`, instead of one `git show` per file. (81787c8)
- 🏗️ **require-changeset:** Count a submodule bump, or any file of a package whose `publishConfig.directory` lies outside it, as shipped; leave a deleted file or a Changesets config edit to the owner as any changeset; never count a single-package repo's pending changesets as shipped. (81787c8)
- Updated dependencies [81787c8]
  - actions-lib@0.2.0

## 0.1.0

### Minor Changes

- ✨ **actions:** Fail a pull request that adds no changeset, skipping the version PR and Renovate PRs that ship nothing. (a84b5ec)

### Patch Changes

- Updated dependencies [a84b5ec]
  - actions-lib@0.1.0
