---
"actions-lib": minor
---

Drop `ChangesetConfig.isPrivateTagged` and `isReleased`'s `isPrivateAllowed`, which now reads `isPrivateVersioned`, and add `runChangesetJson`, which runs a changeset command with `--output`, hands its file to a `read` callback and removes the temp folder unless asked to keep it.
