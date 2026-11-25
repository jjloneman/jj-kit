/*
 * Copied from okf-tools until the kit ships its own Prettier config.
 *
 * - #7 replaces this file with `@jjloneman/kit-prettier-config`.
 *
 * - The Markdown override below is jj-kit's own, not okf-tools', so #7 must
 *   keep it (see docs/decisions/markdown-wrap.md).
 */
import type { Config } from "prettier";

const CONFIG: Config = {
  overrides: [
    /*
     * The git hooks are POSIX shell scripts with no extension, so Prettier
     * can't infer a parser from the filename.
     *
     * - Matched by `!(*.*)` (extensionless files only) rather than
     *   `.githooks/*`, so a non-shell file added later keeps its own parser.
     */
    {
      files: ".githooks/!(*.*)",
      options: { parser: "sh" },
    },

    /*
     * JSONC files are hand-edited, so keep them free of the trailing commas
     * the es5 default would add.
     *
     * - `tsconfig.json` is listed by name because Prettier parses it as JSONC
     *   despite the `.json` extension.
     */
    {
      files: ["*.jsonc", "tsconfig.json"],
      options: { trailingComma: "none" },
    },

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
  plugins: ["prettier-plugin-sh"],
  trailingComma: "es5",
};

export default CONFIG;
