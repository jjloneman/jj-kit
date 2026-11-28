# setup

## 0.2.0

### Minor Changes

- 🔧 **setup:** Add a `cache` input, so a job with write permissions, or one that builds what's published, can install without the pnpm store cache another job saved, and warn when a job that can request an OIDC token keeps the cache on. (6e7ada5)
- ⚡️ **release:** Add an `install` input whose `root` installs only the workspace root's `dependencies`, for a release job that runs only the Changesets CLI. (9a36107)

### Patch Changes

- ☁️ **actions:** Pin each third-party action it runs by full commit SHA, with its tag in a comment, so a SHA pin of this action also freezes the steps it runs. (b86df46)

## 0.1.0

### Minor Changes

- ✨ **actions:** Install pnpm, Node and the frozen-lockfile dependency tree, the prelude every CI job that runs a pnpm script shares. (995c5ce)
