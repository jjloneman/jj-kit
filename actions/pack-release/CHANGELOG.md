# pack-release

## 0.1.1

### Patch Changes

- ☁️ **actions:** Pin each third-party action it runs by full commit SHA, with its tag in a comment, so a SHA pin of this action also freezes the steps it runs. (b86df46)
- 🏗️ **require-changeset:** Read the publish plan through the shared `runChangesetJson`, failing with "changeset publish-plan failed; see its output above." when the command fails, or with the spawn error when it can't start. (81787c8)
- Updated dependencies [81787c8]
  - actions-lib@0.2.0

## 0.1.0

### Minor Changes

- 🏗️ **actions:** Decide whether a release run opens the version PR, publishes or does nothing, and build and pack the release through `changesets/action/pack` in a job without write access. (ff96e49)
