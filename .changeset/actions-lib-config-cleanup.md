---
"actions-lib": minor
---

Drop `ChangesetConfig.isPrivateTagged`; `isReleased` loses its `isPrivateAllowed` parameter and reads `config.isPrivateVersioned` itself. Add `runChangesetJson`, which runs a changeset command with `--output`, hands its file to a `read` callback and removes the temp folder unless asked to keep it.
