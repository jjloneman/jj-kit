/*
 * jj-kit's Prettier config: the kit's own base, plus the Markdown wrap only
 * this repo uses.
 *
 * - The base is imported from `kit-prettier-config`'s source by relative
 *   path, as `.changeset/config.json` loads the changelog formatter, so
 *   formatting needs no build first.
 */
import type { Config } from "prettier";

import BASE, { OVERRIDES } from "./packages/prettier-config/src/index.ts";

const CONFIG: Config = {
  ...BASE,
  overrides: [
    ...OVERRIDES,

    /*
     * Wrap Markdown at `printWidth`, so files read well side by side in
     * GitHub and VS Code.
     *
     * - Scoped to Markdown files because `proseWrap` also rewraps YAML's
     *   folded scalars, such as a workflow's `run: >-` commands.
     *
     * - A record's frontmatter is YAML inside the Markdown, so its
     *   `description` wraps too.
     *
     * - Changesets are left alone, since a wrapped summary would reach
     *   `CHANGELOG.md` as several lines; `.changeset/README.md` still wraps.
     *
     * - `files` has a slash so `excludeFiles` matches the whole path; with a
     *   bare `*.md`, Prettier matches the exclusion by basename too.
     */
    {
      excludeFiles: ".changeset/!(README).md",
      files: "**/*.md",
      options: { proseWrap: "always" },
    },
  ],
};

export default CONFIG;
