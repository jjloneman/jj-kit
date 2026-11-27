---
"require-changeset": patch
---

Count a submodule bump, or any file of a package whose `publishConfig.directory` lies outside it, as shipped; leave a deleted file or a Changesets config edit to the owner as any changeset; never count a single-package repo's pending changesets as shipped.
