import type { ViteUserConfig } from "vitest/config";

import { globSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/*
 * Each package's and action's folder, relative to the repo root.
 *
 * - Found by its `package.json`, so a leftover folder holding only
 *   gitignored `node_modules` or `dist` after a branch switch isn't mistaken
 *   for a package.
 */
const PACKAGE_DIRS: string[] = globSync(
  ["actions/*/package.json", "packages/*/package.json"],
  {
    cwd: import.meta.dirname,
  }
).map((manifest) => path.dirname(manifest));

const CONFIG: ViteUserConfig = defineConfig({
  /*
   * Vitest's root defaults to the cwd, so pin it to this file's folder.
   *
   * - `projects` and the coverage globs below resolve against it, so they
   *   match the same files wherever Vitest starts.
   */
  root: import.meta.dirname,
  test: {
    /*
     * One coverage report across every package and action, gated at 100%.
     *
     * - An explicit `include` counts untested files against coverage instead
     *   of leaving them out of the report.
     *
     * - `text` is listed twice: the bare entry prints to the log, and the one
     *   given a `file` writes the per-file table to `coverage/`.
     */
    coverage: {
      exclude: ["{actions,packages}/*/src/**/*.test.ts"],
      include: ["{actions,packages}/*/src/**/*.ts"],
      provider: "v8",
      reporter: [
        "html",
        "json",
        "json-summary",
        "text",
        ["text", { file: "coverage.txt" }],
      ],
      thresholds: { 100: true },
    },

    /*
     * Each package and action is its own Vitest project, configured by its own
     * `vitest.config.ts` when it needs more than the defaults.
     *
     * - `eslint-rules/` is one too, for the local rules' tests, though it has
     *   no `package.json` and sits outside the coverage gate.
     */
    projects: [...PACKAGE_DIRS, "eslint-rules"],
  },
});

export default CONFIG;
