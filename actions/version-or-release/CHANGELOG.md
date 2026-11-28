# version-or-release

## 0.2.1

### Patch Changes

- ☁️ **actions:** Pin each third-party action it runs by full commit SHA, with its tag in a comment, so a SHA pin of this action also freezes the steps it runs. (b86df46)
- ☁️ **release:** Fail first, naming `install: root` and the root's `dependencies`, when `@changesets/cli` doesn't resolve from the repo root. (9e6e84a)
- ⚡️ **release:** Say what the release job must install: the Changesets CLI at the root, its config's plugins and, unless `format` is false, its formatter. (9a36107)

## 0.2.0

### Minor Changes

- 🏗️ **actions:** Publish the pack `pack-release` uploaded through `changesets/action/publish`, and open the version PR through `changesets/action/version`, taking `pack-release`'s `next` and `pack-dir-artifact-id`; the `publish-script` input and the empty-changeset set-aside are gone. (ff96e49)

## 0.1.0

### Minor Changes

- ✨ **actions:** Keep the rolling version PR open, labeled and assigned, or publish once it merges, even past empty changesets. (a84b5ec)

### Patch Changes

- Updated dependencies [a84b5ec]
  - actions-lib@0.1.0
