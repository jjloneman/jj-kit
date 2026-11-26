# version-or-release

## 0.2.0

### Minor Changes

- 🏗️ **actions:** Publish the pack `pack-release` uploaded through `changesets/action/publish`, and open the version PR through `changesets/action/version`, taking `pack-release`'s `next` and `pack-dir-artifact-id`; the `publish-script` input and the empty-changeset set-aside are gone. (ff96e49)

## 0.1.0

### Minor Changes

- ✨ **actions:** Keep the rolling version PR open, labeled and assigned, or publish once it merges, even past empty changesets. (a84b5ec)

### Patch Changes

- Updated dependencies [a84b5ec]
  - actions-lib@0.1.0
