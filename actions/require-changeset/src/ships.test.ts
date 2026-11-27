import { describe, expect, test, vi } from "vitest";

import type { PackFiles, RenovateChange, Tree } from "./ships.ts";

import {
  analyzeRenovateChange,
  isAnalyzedFile,
  isManifestFile,
} from "./ships.ts";

/** A JSON object to write as a fixture file. */
type Json = Record<string, unknown>;

/** A Changesets config that versions private packages. */
const VERSIONS_PRIVATE = { privatePackages: { version: true } };

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
const SOLO: Json = { files: ["dist"], name: "solo", version: "1.0.0" };

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
  packed = {},
}: {
  /** The base tree's files, the monorepo by default. */
  base?: Record<string, unknown>;

  /** The files to replace, add or, as `null`, remove. */
  change: Record<string, unknown>;

  /** The paths the PR changes. */
  changedFiles: readonly string[];

  /** What `pnpm pack` lists in each folder, none by default. */
  packed?: Record<string, readonly string[]>;
}): RenovateChange {
  return analyzeRenovateChange({
    after: makeTree({ ...base, ...change }),
    before: makeTree(base),
    changedFiles,
    packFiles: fakePack(packed),
    parseYaml: JSON.parse,
  });
}

/**
 * Fakes `pnpm pack --dry-run`, listing each folder's files.
 *
 * @param packed - each folder's packed files, by folder.
 * @returns the packer.
 */
function fakePack(packed: Record<string, readonly string[]>): PackFiles {
  return (folder) => new Set(packed[folder] ?? []);
}

/** Marks a fixture path as a submodule rather than a file. */
const SUBMODULE = Symbol("submodule");

/**
 * Builds a tree from fixture files, writing a string as is, any other value
 * as JSON, skipping `null`, and listing `SUBMODULE` as a submodule.
 *
 * - Like the real reader, it throws for a listed file the analysis shouldn't
 *   read, so a test catches a read the reader would refuse.
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

  const submodules = new Set(
    Object.entries(files)
      .filter(([_file, content]) => content === SUBMODULE)
      .map(([file]) => file)
  );

  return {
    has: (file) => texts.has(file),
    isSubmodule: (file) => submodules.has(file),
    list: () => [...texts.keys()],
    read: (file) => {
      if (texts.has(file) && !isAnalyzedFile(file)) {
        throw new Error(`The analysis read ${file}, which it never batches.`);
      }

      return texts.get(file);
    },
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
      description: "a file pnpm packs ships its package",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
      packed: { "packages/a": ["package.json", "src/index.ts"] },
    },
    {
      change: {
        ".changeset/config.json": VERSIONS_PRIVATE,
        "apps/web/action.yml": "name: web",
      },
      changedFiles: ["apps/web/action.yml"],
      description: "a versioned private package's action.yml ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["web"] },
      packed: { "apps/web": ["action.yml", "package.json"] },
    },
    {
      change: { "packages/a/tsconfig.json": "{}" },
      changedFiles: ["packages/a/tsconfig.json"],
      description: "a file pnpm doesn't pack needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      packed: { "packages/a": ["dist/index.js", "package.json"] },
    },
    {
      change: {
        "packages/a/lib/index.js": "",
        "packages/a/package.json": {
          ...PACKAGE_A,
          publishConfig: { directory: "./lib/" },
        },
      },
      changedFiles: ["packages/a/lib/index.js"],
      description: "a file in publishConfig.directory ships its package",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
      packed: { "packages/a": ["index.js", "package.json"] },
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          publishConfig: { directory: "lib" },
        },
        "packages/a/src/index.ts": "export const a = 1;",
      },
      changedFiles: ["packages/a/src/index.ts"],
      description: "a file outside publishConfig.directory needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      packed: { "packages/a": ["package.json", "src/index.ts"] },
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          publishConfig: { directory: "../../dist/a" },
        },
        "packages/a/src/index.ts": "export const a = 1;",
      },
      changedFiles: ["packages/a/src/index.ts"],
      description:
        "a publishConfig.directory outside the package ships every file",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
      packed: {},
    },
    {
      change: {
        "packages/a/package.json": {
          ...PACKAGE_A,
          publishConfig: { directory: "/out" },
        },
        "packages/a/src/index.ts": "export const a = 1;",
      },
      changedFiles: ["packages/a/src/index.ts"],
      description: "a publishConfig.directory absolute ships every file",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
      packed: {},
    },
    {
      change: { "packages/a/vendor/lib": SUBMODULE },
      changedFiles: ["packages/a/vendor/lib"],
      description: "a submodule bump ships, packed or not",
      expected: { hasOtherChanges: false, shippedPackages: ["@acme/a"] },
      packed: { "packages/a": ["package.json"] },
    },
    {
      change: { ".changeset/config.json": { ignore: [] } },
      changedFiles: [".changeset/config.json"],
      description: "a monorepo's Changesets config needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      packed: {},
    },
    {
      change: { ".changeset/config.json": VERSIONS_PRIVATE, "apps/web/x": "" },
      changedFiles: ["apps/web/x"],
      description: "a versioned private package with no pack list doesn't ship",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      packed: {},
    },
    {
      change: { "packages/a/src/index.ts": null },
      changedFiles: ["packages/a/src/index.ts"],
      description: "a file the PR deletes needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      packed: { "packages/a": ["package.json"] },
    },
    {
      change: { "packages/b/package.json": null, "packages/b/src/b.ts": "" },
      changedFiles: ["packages/b/src/b.ts"],
      description: "a file of a package the PR deletes ships nothing",
      expected: { hasOtherChanges: false, shippedPackages: [] },
      packed: {},
    },
    {
      change: { "apps/web/action.yml": "name: web" },
      changedFiles: ["apps/web/action.yml"],
      description: "an unversioned private package's file needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      packed: { "apps/web": ["action.yml"] },
    },
    {
      change: {},
      changedFiles: [".github/workflows/ci.yml", "pnpm-lock.yaml", "x.md"],
      description: "a monorepo's root files ship nothing",
      expected: { hasOtherChanges: false, shippedPackages: [] },
      packed: { ".": ["x.md"] },
    },
  ])("$description", ({ change, changedFiles, expected, packed }) => {
    // Given - a change to a file other than a manifest.

    // When - it's analyzed.
    const result = analyze({ change, changedFiles, packed });

    // Then - it ships the package that holds it, if versioned.
    expect(result).toStrictEqual(expected);
  });

  test.each([
    {
      changedFiles: ["dist/index.js"],
      description: "a file pnpm packs ships it",
      expected: { hasOtherChanges: false, shippedPackages: ["solo"] },
      root: SOLO,
    },
    {
      changedFiles: ["dist/index.js.map", ".nvmrc", "src/cli.ts"],
      description: "files pnpm doesn't pack need a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      root: SOLO,
    },
    {
      changedFiles: ["dist/index.js"],
      description: "an unversioned private root's file needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      root: { ...SOLO, private: true },
    },
    {
      changedFiles: ["src/cli.ts"],
      description: "a nameless root's file needs a changeset",
      expected: { hasOtherChanges: true, shippedPackages: [] },
      root: { name: "solo" },
    },
    {
      changedFiles: [
        ".changeset/bump.md",
        ".github/workflows/ci.yml",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
      ],
      description:
        "the lockfile, workspace file, changesets and workflows don't",
      expected: { hasOtherChanges: false, shippedPackages: [] },
      root: SOLO,
    },
  ])(
    "in a single-package repo, $description",
    ({ changedFiles, expected, root }) => {
      // Given - a repo whose root is its only package, packing every
      // changeset, workflow, lockfile and workspace file but only
      // `dist/index.js` of the rest.
      const files = Object.fromEntries(
        changedFiles
          .filter((file) => !isManifestFile(file))
          .map((file) => [file, ""])
      );

      // When - a change is analyzed.
      const result = analyze({
        base: { ...files, "package.json": root, "pnpm-workspace.yaml": "null" },
        change: {},
        changedFiles,
        packed: {
          ".": [
            ".changeset/bump.md",
            ".github/workflows/ci.yml",
            "dist/index.js",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
          ],
        },
      });

      // Then - root files ship only as pnpm packs them.
      expect(result).toStrictEqual(expected);
    }
  );

  test("a file left by a deleted nested package ships the outer one", () => {
    // Given - a package nested inside `@acme/a`, which the PR deletes while
    // keeping, and changing, one of its files.
    const base = {
      "packages/a/package.json": PACKAGE_A,
      "packages/a/sub/index.js": "",
      "packages/a/sub/package.json": { name: "@acme/sub", version: "1.0.0" },
      "pnpm-workspace.yaml": { packages: ["packages/**"] },
    };

    // When - it's analyzed.
    const result = analyze({
      base,
      change: {
        "packages/a/sub/index.js": "export {};",
        "packages/a/sub/package.json": null,
      },
      changedFiles: ["packages/a/sub/index.js", "packages/a/sub/package.json"],
      packed: { "packages/a": ["sub/index.js"] },
    });

    // Then - the file now ships with `@acme/a`, and the deleted manifest
    // ships nothing.
    expect(result).toStrictEqual({
      hasOtherChanges: false,
      shippedPackages: ["@acme/a"],
    });
  });

  test("never packs an unbuilt publishConfig.directory", () => {
    // Given - a package publishing an unbuilt `lib/`, where pnpm pack fails.
    const packFiles = vi.fn<PackFiles>(() => {
      throw new Error("ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND");
    });
    const files = {
      ...BASE_FILES,
      "packages/a/package.json": {
        ...PACKAGE_A,
        publishConfig: { directory: "lib" },
      },
      "packages/a/src/index.ts": "export const a = 1;",
    };

    // When - a source file outside `lib/` changes.
    const result = analyzeRenovateChange({
      after: makeTree(files),
      before: makeTree(files),
      changedFiles: ["packages/a/src/index.ts"],
      packFiles,
      parseYaml: JSON.parse,
    });

    // Then - it needs a changeset, without packing.
    expect(packFiles).not.toHaveBeenCalled();

    expect(result).toStrictEqual({
      hasOtherChanges: true,
      shippedPackages: [],
    });
  });

  test("packs each package at most once, and only for a non-manifest file", () => {
    // Given - a packer that records its calls.
    const packFiles = vi.fn(fakePack({ "packages/a": ["src/index.ts"] }));
    const base = makeTree(BASE_FILES);
    const after = makeTree({
      ...BASE_FILES,
      "packages/a/src/extra.ts": "",
      "packages/a/src/index.ts": "export const a = 1;",
    });

    // When - two of one package's files and its manifest change.
    const result = analyzeRenovateChange({
      after,
      before: base,
      changedFiles: [
        "packages/a/package.json",
        "packages/a/src/extra.ts",
        "packages/a/src/index.ts",
      ],
      packFiles,
      parseYaml: JSON.parse,
    });

    // Then - it packed that package once, and one file ships it while the
    // other needs a changeset.
    expect(packFiles.mock.calls).toStrictEqual([["packages/a"]]);
    expect(result).toStrictEqual({
      hasOtherChanges: true,
      shippedPackages: ["@acme/a"],
    });
  });

  test("a single-package repo's Changesets config needs a changeset", () => {
    // Given - a versioned root whose config pnpm would pack.

    // When - its Changesets config changes.
    const result = analyze({
      base: {
        ".changeset/config.json": "{}",
        "package.json": SOLO,
        "pnpm-workspace.yaml": "null",
      },
      change: { ".changeset/config.json": '{"ignore":[]}' },
      changedFiles: [".changeset/config.json"],
      packed: { ".": [".changeset/config.json"] },
    });

    // Then - it needs a changeset but no release.
    expect(result).toStrictEqual({
      hasOtherChanges: true,
      shippedPackages: [],
    });
  });

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
      packFiles: fakePack({}),
      parseYaml: JSON.parse,
    });
    const withSource = analyzeRenovateChange({
      after: tree,
      before: tree,
      changedFiles: ["apps/web/plugins/p/index.ts"],
      packFiles: fakePack({}),
      parseYaml: JSON.parse,
    });

    // Then - its manifest isn't another change to the outer package.
    expect(manifestOnly.hasOtherChanges).toBe(false);
    expect(withSource.hasOtherChanges).toBe(true);
  });

  test("skips package folders under node_modules, as pnpm does", () => {
    // Given - a package with a tracked dependency folder holding a manifest,
    // which it bundles.

    // When - a file in that folder changes.
    const result = analyze({
      base: {
        "packages/a/node_modules/x/index.js": "",
        "packages/a/node_modules/x/package.json": {
          name: "x",
          version: "1.0.0",
        },
        "packages/a/package.json": PACKAGE_A,
        "pnpm-workspace.yaml": { packages: ["packages/**"] },
      },
      change: {},
      changedFiles: ["packages/a/node_modules/x/index.js"],
      packed: { "packages/a": ["node_modules/x/index.js"] },
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
      packFiles: fakePack({}),
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
});
