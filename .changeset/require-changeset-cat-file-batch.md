---
"require-changeset": patch
---

Read both revisions' manifests, workspace file and Changesets config through one `git cat-file --batch`, instead of one `git show` per file.
