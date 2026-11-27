---
"require-changeset": minor
---

A Renovate PR now needs pnpm 10.26 or later: the check asks `pnpm pack --dry-run --ignore-scripts --ignore-pnpmfile` which files each package publishes, instead of copying npm's packing rules.
