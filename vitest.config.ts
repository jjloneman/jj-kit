import type { ViteUserConfig } from "vitest/config";

import { globSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/*
 * Each package's folder, relative to the repo root.
 *
 * - Found by its `package.json`, so a leftover folder holding only
 *   gitignored `node_modules` or `dist` after a branch switch isn't mistaken
 *   for a package.
 *
 * - Vitest refuses to start when `projects` matches nothing, so the list is
 *   only set once there's a package to match. Drop that guard, and
 *   `passWithNoTests`, once the first package ships its tests.
 */
const PACKAGE_DIRS: string[] = globSync("packages/*/package.json", {
  cwd: import.meta.dirname,
}).map((manifest) => path.dirname(manifest));

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
     * One coverage report across every package, gated at 100%.
     *
     * - An explicit `include` counts untested files against coverage instead
     *   of leaving them out of the report.
     *
     * - `text` is listed twice: the bare entry prints to the log, and the one
     *   given a `file` writes the per-file table to `coverage/`.
     */
    coverage: {
      exclude: ["packages/*/src/**/*.test.ts"],
      include: ["packages/*/src/**/*.ts"],
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
    passWithNoTests: true,

    // Each package is its own Vitest project, configured by its own
    // `vitest.config.ts` when it needs more than the defaults.
    ...(PACKAGE_DIRS.length > 0 ? { projects: PACKAGE_DIRS } : {}),
  },
});

export default CONFIG;
