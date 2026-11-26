---
"setup": minor
---

Add a `cache` input, so a job with write permissions, or one that builds what's published, can install without the pnpm store cache another job saved, and warn when a job that can request an OIDC token keeps the cache on.
