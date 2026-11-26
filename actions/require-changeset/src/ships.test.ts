import { describe, expect, test, vi } from "vitest";

import type { RenovateChange, Tree } from "./ships.ts";

import { analyzeRenovateChange } from "./ships.ts";

/** A JSON object to write as a fixture file. */
type Json = Record<string, unknown>;

/** A Changesets config that versions private packages. */
const VERSIONS_PRIVATE = { privatePackages: { tag: true, version: true } };

/** The workspace every case starts from, written as JSON, which is YAML. */
const WORKSPACE: Json = {
  catalog: { "left-pad": "1.0.0" },
  catalogs: {
    default: { "right-pad": "1.0.0" },
    legacy: { "up-pad": "1.0.0" },
  },
  packages: ["./packages/*", "!./packages/ignored", "apps/*/"],
};

/** The base tree's `packages/a` manifest. */
const PACKAGE_A: Json = {
  dependencies: { "left-pad": "catalog:", lodash: "^4.0.0" },
  devDependencies: { vitest: "5.0.0" },
  engines: { node: ">=26" },
  name: "@acme/a",
  version: "1.0.0",
};

/** The base tree's private `apps/web` manifest. */
const WEB: Json = {
  dependencies: { react: "19.0.0" },
  name: "web",
  private: true,
  version: "0.1.0",
};

/** The monorepo every case starts from. */
const BASE_FILES: Record<string, unknown> = {
  "apps/web/package.json": WEB,
  "package.json": { private: true },
  "packages/a/package.json": PACKAGE_A,
  "packages/a/src/index.ts": "export {};",
  "packages/b/package.json": {
    name: "@acme/b",
    optionalDependencies: { "up-pad": "catalog:legacy" },
    peerDependencies: { "right-pad": "catalog:default" },
    version: "1.0.0",
  },
  "packages/ignored/package.json": { dependencies: { lodash: "^4.0.0" } },
  "pnpm-workspace.yaml": WORKSPACE,
  "tools/x/package.json": { dependencies: { lodash: "^4.0.0" } },
};

/** The single-package repo the root cases start from. */
const SOLO: Json = {
  bin: { solo: "./bin/solo.js" },
  files: ["dist/", "!dist/*.map"],
  main: "index.js",
  name: "solo",
  version: "1.0.0",
};

/**
 * Compares a base tree with one changed by `change`, where `null` removes a
 * file.
 *
 * @returns what the change ships.
 */
function analyze({
  base = BASE_FILES,
  change,
  changedFiles,
}: {
  /** The base tree's files, the monorepo by default. */
  base?: Record<string, unknown>;

  /** The files to replace, add or, as `null`, remove. */
  change: Record<string, unknown>;

  /** The paths the PR changes. */
  changedFiles: readonly string[];
}): RenovateChange {
  return analyzeRenovateChange({
    after: makeTree({ ...base, ...change }),
    before: makeTree(base),
    changedFiles,
    parseYaml: JSON.parse,
  });
}

/**
 * Builds a tree from fixture files, writing a string as is, any other value
 * as JSON, and skipping `null`.
 *
 * @param files - each file's path and content.
 * @returns the tree.
 */
function makeTree(files: Record<string, unknown>): Tree {
  const texts = new Map(
    Object.entries(files)
      .filter(([_file, content]) => content !== null)
      .map(([file, content]) => [
        file,
        typeof content === "string" ? content : JSON.stringify(content),
      ])
  );

  return {
    list: () => [...texts.keys()],
    read: (file) => texts.get(file),
  };
}

describe("analyzeRenovateChange", () => {
  test.each([
    {
      change: {},
      changedFiles: [],
      description: "no change ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          dependencies: { "left-pad": "catalog:", lodash: "^4.1.0" },
        },
      },
      changedFiles: ["packages/a/package.json"],
      description: "a dependency bump ships its package",
      shippedPackages: ["@acme/a"],
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          devDependencies: { vitest: "5.1.0" },
        },
      },
      changedFiles: ["packages/a/package.json"],
      description: "a dev dependency bump ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        "packages/a/package.json": { ...PACKAGE_A, engines: { node: ">=27" } },
      },
      changedFiles: ["packages/a/package.json"],
      description: "an engines change ships",
      shippedPackages: ["@acme/a"],
    },
    {
      change: {
        "pnpm-workspace.yaml": { ...WORKSPACE, catalog: { "left-pad": "1.1" } },
      },
      changedFiles: ["pnpm-workspace.yaml"],
      description: "a top-level catalog bump ships its users",
      shippedPackages: ["@acme/a"],
    },
    {
      change: {
        "pnpm-workspace.yaml": {
          ...WORKSPACE,
          catalogs: {
            default: { "right-pad": "2.0.0" },
            legacy: { "up-pad": "1.0.0" },
          },
        },
      },
      changedFiles: ["pnpm-workspace.yaml"],
      description: "a named default catalog bump ships its users",
      shippedPackages: ["@acme/b"],
    },
    {
      change: {
        "pnpm-workspace.yaml": {
          ...WORKSPACE,
          catalogs: { default: { "right-pad": "1.0.0" } },
        },
      },
      changedFiles: ["pnpm-workspace.yaml"],
      description: "a named catalog entry going missing ships",
      shippedPackages: ["@acme/b"],
    },
    {
      change: {
        "pnpm-workspace.yaml": {
          ...WORKSPACE,
          catalog: { "left-pad": "1.0.0", vitest: "5.1.0" },
        },
      },
      changedFiles: ["pnpm-workspace.yaml"],
      description: "a catalog entry no package ships with ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          dependencies: { "left-pad": "catalog:", "no-pad": "catalog:" },
        },
      },
      changedFiles: ["packages/a/package.json"],
      description: "a catalog spec with no catalog entry still compares",
      shippedPackages: ["@acme/a"],
    },
    {
      change: {
        "packages/ignored/package.json": { dependencies: { lodash: "^5" } },
      },
      changedFiles: ["packages/ignored/package.json"],
      description: "a package the workspace excludes ships nothing",
      shippedPackages: [],
    },
    {
      change: { "tools/x/package.json": { dependencies: { lodash: "^5" } } },
      changedFiles: ["tools/x/package.json"],
      description: "a folder outside the workspace ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        "apps/web/package.json": { ...WEB, dependencies: { react: "19.1.0" } },
      },
      changedFiles: ["apps/web/package.json"],
      description: "an unversioned private package ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        ".changeset/config.json": VERSIONS_PRIVATE,
        "apps/web/package.json": { ...WEB, dependencies: { react: "19.1.0" } },
      },
      changedFiles: ["apps/web/package.json"],
      description: "a versioned private package ships its dependencies",
      shippedPackages: ["web"],
    },
    {
      change: {
        "package.json": {
          dependencies: { lodash: "^5" },
          name: "@acme/root",
          version: "1.0.0",
        },
      },
      changedFiles: ["package.json"],
      description: "a monorepo's root ships nothing, even when public",
      shippedPackages: [],
    },
    {
      change: { "packages/c/package.json": { dependencies: { a: "1" } } },
      changedFiles: ["packages/c/package.json"],
      description: "a new package without a name or version ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        "packages/c/package.json": { name: "@acme/c", version: "0.0.0" },
      },
      changedFiles: ["packages/c/package.json"],
      description: "a new versioned package ships",
      shippedPackages: ["@acme/c"],
    },
    {
      change: {
        ".changeset/config.json": { ignore: ["@acme/a"] },
        "packages/a/package.json": { ...PACKAGE_A, engines: { node: ">=27" } },
      },
      changedFiles: ["packages/a/package.json"],
      description: "a package the config ignores ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        "packages/a/package.json": { ...PACKAGE_A, exports: "./dist/a.js" },
      },
      changedFiles: ["packages/a/package.json"],
      description: "an exports change ships",
      shippedPackages: ["@acme/a"],
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          publishConfig: { exports: "./dist/a.js" },
        },
      },
      changedFiles: ["packages/a/package.json"],
      description: "a publishConfig change ships",
      shippedPackages: ["@acme/a"],
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          engines: { node: ">=27" },
          version: "",
        },
      },
      changedFiles: ["packages/a/package.json"],
      description: "a package with an empty version ships nothing",
      shippedPackages: [],
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          dependencies: { "left-pad": "catalog:", lodash: 4 },
          name: "@acme/renamed",
        },
      },
      changedFiles: ["packages/a/package.json"],
      description: "a renamed package ships under its new name",
      shippedPackages: ["@acme/renamed"],
    },
    {
      change: { "packages/b/package.json": null },
      changedFiles: ["packages/b/package.json"],
      description: "a removed package ships nothing",
      shippedPackages: [],
    },
  ])("$description", ({ change, changedFiles, shippedPackages }) => {
    // Given - the base monorepo and the change.

    // When - the two are compared.
    const result = analyze({ change, changedFiles });

    // Then - only versioned packages whose shipped fields changed ship.
    expect(result).toStrictEqual({ hasOtherChanges: false, shippedPackages });
  });

  test.each([
    {
      change: { "packages/a/src/index.ts": "export const a = 1;" },
      changedFiles: ["packages/a/src/index.ts"],
      description: "a public package's source file ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
    },
    {
      change: {
        ".changeset/config.json": VERSIONS_PRIVATE,
        "apps/web/action.yml": "name: web",
      },
      changedFiles: ["apps/web/action.yml"],
      description: "a versioned private package's action.yml ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["web"] },
    },
    {
      change: {
        "packages/a/package.json": { ...PACKAGE_A, files: ["dist"] },
        "packages/a/tsconfig.json": "{}",
      },
      changedFiles: ["packages/a/tsconfig.json"],
      description: "a file outside a package's files list needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
    },
    {
      change: {
        "packages/a/package.json": { ...PACKAGE_A, files: ["templates"] },
        "packages/a/templates/.github/ci.yml": "",
      },
      changedFiles: ["packages/a/templates/.github/ci.yml"],
      description: "a dotfile under a files folder ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
    },
    {
      change: {
        "packages/a/package.json": { ...PACKAGE_A, files: [] },
        "packages/a/README.md": "",
      },
      changedFiles: ["packages/a/README.md"],
      description: "an empty files list still publishes the README",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
    },
    {
      change: {
        "packages/a/package.json": { ...PACKAGE_A, files: [] },
        "packages/a/src/x.ts": "",
      },
      changedFiles: ["packages/a/src/x.ts"],
      description: "an empty files list leaves source files out",
      expected: { hasOtherChanges: true, shippedPackages: [] },
    },
    {
      change: {
        "packages/a/dist/a.js": "",
        "packages/a/package.json": { ...PACKAGE_A, files: ["dist"] },
      },
      changedFiles: ["packages/a/dist/a.js"],
      description: "a file inside a package's files list ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
    },
    {
      change: { "packages/b/package.json": null, "packages/b/src/b.ts": "" },
      changedFiles: ["packages/b/src/b.ts"],
      description: "a file of a package the PR deletes ships nothing",
      expected: { hasOtherChanges: false, shippedPackages: [] },
    },
    {
      change: { "apps/web/action.yml": "name: web" },
      changedFiles: ["apps/web/action.yml"],
      description: "an unversioned private package's file needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
    },
    {
      change: {},
      changedFiles: [".github/workflows/ci.yml", "pnpm-lock.yaml", "x.md"],
      description: "a monorepo's root files ship nothing",
      expected: { hasOtherChanges: false, shippedPackages: [] },
    },
  ])("$description", ({ change, changedFiles, expected }) => {
    // Given - a change to a file other than a manifest.

    // When - it's analyzed.
    const result = analyze({ change, changedFiles });

    // Then - it ships the package that holds it, if versioned.
    expect(result).toStrictEqual(expected);
  });

  test.each([
    {
      changedFiles: ["dist/index.js"],
      description: "a file its files list includes ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["solo"] },
      root: SOLO,
    },
    {
      changedFiles: ["README.md", "index.js", "bin/solo.js"],
      description: "a README, the main file and a bin target ship it",
      expected: { hasOtherChanges: false, shippedPackages: ["solo"] },
      root: SOLO,
    },
    {
      changedFiles: ["dist/index.js"],
      description: "a root-anchored files entry ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["solo"] },
      root: { ...SOLO, files: ["/dist"] },
    },
    {
      changedFiles: ["cli.js"],
      description: "a string bin target ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["solo"] },
      root: { ...SOLO, bin: "cli.js" },
    },
    {
      changedFiles: ["dist/index.js.map", ".nvmrc", "src/cli.ts"],
      description: "files its files list leaves out need a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      root: SOLO,
    },
    {
      changedFiles: ["src/cli.ts"],
      description: "with no files list, a versioned root's file ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["solo"] },
      root: { name: "solo", version: "1.0.0" },
    },
    {
      changedFiles: ["dist/index.js"],
      description: "an unversioned private root's file needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      root: { ...SOLO, private: true },
    },
    {
      changedFiles: ["src/cli.ts"],
      description: "with no files list, a source file needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      root: { name: "solo" },
    },
    {
      changedFiles: ["pnpm-lock.yaml", ".github/workflows/ci.yml"],
      description: "with no files list, the lockfile and workflows don't",
      expected: { hasOtherChanges: false, shippedPackages: [] },
      root: { name: "solo" },
    },
  ])(
    "in a single-package repo, $description",
    ({ changedFiles, expected, root }) => {
      // Given - a repo whose root is its only package.

      // When - a change is analyzed.
      const result = analyze({
        base: { "package.json": root },
        change: {},
        changedFiles,
      });

      // Then - root files ship only as its files list says.
      expect(result).toStrictEqual(expected);
    }
  );

  test("a single-package repo ships its own dependency bump", () => {
    // Given - a public root with no workspace file.

    // When - its dependency is bumped.
    const result = analyze({
      base: {
        "package.json": {
          dependencies: { a: "1" },
          name: "solo",
          version: "1.0.0",
        },
      },
      change: {
        "package.json": {
          dependencies: { a: "2" },
          name: "solo",
          version: "1.0.0",
        },
      },
      changedFiles: ["package.json"],
    });

    // Then - the root package ships.
    expect(result).toStrictEqual({
      hasOtherChanges: false,
      shippedPackages: ["solo"],
    });
  });

  test("a workspace with no packages and no root manifest ships nothing", () => {
    // Given - only a workspace file, as for catalogs alone.

    // When - a root file changes.
    const result = analyze({
      base: { "pnpm-workspace.yaml": {} },
      change: {},
      changedFiles: ["README.md", "pnpm-workspace.yaml"],
    });

    // Then - there's no package for it to ship with.
    expect(result).toStrictEqual({
      hasOtherChanges: false,
      shippedPackages: [],
    });
  });

  test.each([
    {
      description: "listed shallow first",
      files: ["apps/web/package.json", "apps/web/plugins/p/package.json"],
    },
    {
      description: "listed deep first",
      files: ["apps/web/plugins/p/package.json", "apps/web/package.json"],
    },
  ])("judges a nested package by its own folder, $description", ({ files }) => {
    // Given - an unversioned private package nested inside another.
    const tree = makeTree({
      ...Object.fromEntries(files.map((file) => [file, { private: true }])),
      "pnpm-workspace.yaml": { packages: ["apps/*", "apps/*/plugins/*"] },
    });

    // When - the nested manifest, then a file of its own, changes.
    const manifestOnly = analyzeRenovateChange({
      after: tree,
      before: tree,
      changedFiles: ["apps/web/plugins/p/package.json"],
      parseYaml: JSON.parse,
    });
    const withSource = analyzeRenovateChange({
      after: tree,
      before: tree,
      changedFiles: ["apps/web/plugins/p/index.ts"],
      parseYaml: JSON.parse,
    });

    // Then - its manifest isn't another change to the outer package.
    expect(manifestOnly.hasOtherChanges).toBe(false);
    expect(withSource.hasOtherChanges).toBe(true);
  });

  test("skips package folders under node_modules, as pnpm does", () => {
    // Given - a package with a tracked dependency folder holding a manifest.

    // When - a file in that folder changes.
    const result = analyze({
      base: {
        "packages/a/node_modules/x/package.json": {
          name: "x",
          version: "1.0.0",
        },
        "packages/a/package.json": PACKAGE_A,
        "pnpm-workspace.yaml": { packages: ["packages/**"] },
      },
      change: {},
      changedFiles: ["packages/a/node_modules/x/index.js"],
    });

    // Then - it belongs to the outer package, not a package of its own.
    expect(result).toStrictEqual({
      hasOtherChanges: false,
      shippedPackages: ["@acme/a"],
    });
  });

  test("a monorepo whose globs match nothing yet has no root package", () => {
    // Given - package globs but no packages, and a versioned root.

    // When - the root's dependency is bumped.
    const result = analyze({
      base: {
        "package.json": {
          dependencies: { a: "1" },
          name: "r",
          version: "1.0.0",
        },
        "pnpm-workspace.yaml": { packages: ["packages/*"] },
      },
      change: {
        "package.json": {
          dependencies: { a: "2" },
          name: "r",
          version: "1.0.0",
        },
      },
      changedFiles: ["package.json"],
    });

    // Then - Changesets never releases a monorepo root, so nothing ships.
    expect(result).toStrictEqual({
      hasOtherChanges: false,
      shippedPackages: [],
    });
  });

  test("an empty packages list still makes a monorepo", () => {
    // Given - `packages: []` and a versioned root.

    // When - the root's dependency is bumped.
    const result = analyze({
      base: {
        "package.json": {
          dependencies: { a: "1" },
          name: "r",
          version: "1.0.0",
        },
        "pnpm-workspace.yaml": { packages: [] },
      },
      change: {
        "package.json": {
          dependencies: { a: "2" },
          name: "r",
          version: "1.0.0",
        },
      },
      changedFiles: ["package.json"],
    });

    // Then - the root isn't a package, so nothing ships.
    expect(result).toStrictEqual({
      hasOtherChanges: false,
      shippedPackages: [],
    });
  });

  test("reads no package manifest when the PR changes none", () => {
    // Given - a tree that records what's read.
    const tree = makeTree(BASE_FILES);
    const read = vi.fn(tree.read);

    // When - a workflow-only change is analyzed.
    analyzeRenovateChange({
      after: { ...tree, read },
      before: tree,
      changedFiles: [".github/workflows/ci.yml"],
      parseYaml: JSON.parse,
    });

    // Then - only the workspace file and the config were read.
    expect(
      [...new Set(read.mock.calls.map(([file]) => file))].sort()
    ).toStrictEqual([".changeset/config.json", "pnpm-workspace.yaml"]);
  });

  test("an empty workspace file leaves the root as the package", () => {
    // Given - a workspace file that parses to `null`, and a private root.

    // When - a file in what looks like a package folder is added.
    const result = analyze({
      base: {
        "package.json": { private: true },
        "pnpm-workspace.yaml": "null",
      },
      change: { "packages/a/package.json": { dependencies: { a: "1" } } },
      changedFiles: ["packages/a/package.json"],
    });

    // Then - it's a root file, which needs a changeset but no release.
    expect(result).toStrictEqual({
      hasOtherChanges: true,
      shippedPackages: [],
    });
  });

  test.each([
    {
      change: { "packages/a/package.json": [] },
      description: "a manifest that isn't an object",
      error: "packages/a/package.json isn't an object.",
    },
    {
      change: {
        "packages/a/package.json": { ...PACKAGE_A, dependencies: "lodash" },
      },
      description: "dependencies that aren't an object",
      error: "packages/a/package.json's dependencies isn't an object.",
    },
    {
      change: { "pnpm-workspace.yaml": [] },
      description: "a workspace file that isn't an object",
      error: "pnpm-workspace.yaml isn't an object.",
    },
    {
      change: { "pnpm-workspace.yaml": { packages: "packages/*" } },
      description: "workspace packages that aren't a list",
      error: "pnpm-workspace.yaml's packages isn't a list of strings.",
    },
    {
      change: { "pnpm-workspace.yaml": { packages: [1] } },
      description: "workspace packages that aren't strings",
      error: "pnpm-workspace.yaml's packages isn't a list of strings.",
    },
    {
      change: { "pnpm-workspace.yaml": { ...WORKSPACE, catalogs: [] } },
      description: "catalogs that aren't an object",
      error: "pnpm-workspace.yaml's catalogs isn't an object.",
    },
    {
      change: { "package.json": null, "pnpm-workspace.yaml": null },
      description: "a tree with neither root file",
      error: "Found neither package.json nor pnpm-workspace.yaml",
    },
  ])("throws on $description", ({ change, error }) => {
    // Given - a tree with a malformed or missing file.

    // When - a manifest change is analyzed.
    const compare = (): RenovateChange =>
      analyze({
        change,
        changedFiles: ["packages/a/package.json", "pnpm-workspace.yaml"],
      });

    // Then - it throws rather than answer that nothing ships.
    expect(compare).toThrow(error);
  });

  test("throws on a root files list that isn't strings", () => {
    // Given - a single-package repo with a malformed files list.

    // When - a root file is analyzed.
    const compare = (): RenovateChange =>
      analyze({
        base: {
          "package.json": { files: "dist", name: "solo", version: "1.0.0" },
        },
        change: {},
        changedFiles: ["dist/index.js"],
      });

    // Then - it throws.
    expect(compare).toThrow("files isn't a list of strings.");
  });
});
