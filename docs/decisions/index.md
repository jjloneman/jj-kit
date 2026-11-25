---
okf_version: "0.2"
---

# Decisions

- [Why every PR adds a changeset](changeset-every-pr.md) - CI's required `🦋 Changeset` check fails a PR whose `changeset status --output` lists no changeset, since `changeset status` alone passes any PR that changes no package; a PR that ships nothing adds `pnpm changeset --empty`.
