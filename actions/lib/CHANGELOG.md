# actions-lib

## 0.2.0

### Minor Changes

- 🏗️ **require-changeset:** Drop `ChangesetConfig.isPrivateTagged`; `isReleased` loses its `isPrivateAllowed` parameter and reads `config.isPrivateVersioned` itself. Add `runChangesetJson`, which runs a changeset command with `--output`, hands its file to a `read` callback and removes the temp folder unless asked to keep it. (81787c8)

## 0.1.0

### Minor Changes

- ✨ **actions:** Share annotations, the release plan reader and the Node check between the kit's actions. (a84b5ec)
