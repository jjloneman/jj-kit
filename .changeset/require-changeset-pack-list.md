---
"require-changeset": minor
---

Judge whether a Renovate PR's changed file ships by what `pnpm pack --dry-run --ignore-scripts --ignore-pnpmfile` lists, leaving a deleted file to the owner like a build config, never counting a single-package repo's pending changesets as shipped, counting a submodule bump as shipped, asking for a changeset on a Changesets config edit, matching under `publishConfig.directory`, and read both revisions' manifests through one `git cat-file --batch`; a Renovate PR now needs pnpm 10.26 or later.
