import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { ChangesetConfig } from "../../lib/src/changeset-config.ts";

import {
  CHANGESET_CONFIG,
  isReleased,
  readChangesetConfig,
} from "../../lib/src/changeset-config.ts";

/**
 * Lists the files a package publishes, as `pnpm pack --dry-run` does.
 *
 * @param folder - the package's folder, such as `packages/a`, or `.` for the
 *   root.
 * @returns each file's path, relative to the folder.
 */
export type PackFiles = (folder: string) => ReadonlySet<string>;

/** Parses YAML text into plain data, as `yq -o json` does. */
export type ParseYaml = (text: string) => unknown;

/** What a Renovate PR changes, as far as the changeset check cares. */
export type RenovateChange = {
  /**
   * Whether it changes a file that needs a changeset but no release: one in a
   * package Changesets doesn't version, or one a versioned package doesn't
   * publish, such as a build config.
   */
  hasOtherChanges: boolean;

  /**
   * The versioned packages it ships a change to, sorted, each of which a
   * changeset must release.
   */
  shippedPackages: readonly string[];
};

/** A read-only view of the repo's files at one revision. */
export type Tree = {
  /** Whether the revision has a file at a path, relative to the repo root. */
  has: (file: string) => boolean;

  /** Whether a path is a submodule, rather than a file, in the revision. */
  isSubmodule: (file: string) => boolean;

  /** Every file path in the revision, relative to the repo root. */
  list: () => readonly string[];

  /** A file's text, or `undefined` when the revision has no such file. */
  read: (file: string) => string | undefined;
};

/** What every changed file is judged against, worked out once. */
type Context = {
  /** The tree with the change. */
  after: Tree;

  /** The Changesets config. */
  config: ChangesetConfig;

  /** Every workspace package's folder, at either revision. */
  folders: readonly string[];

  /** Both revisions' layouts, the change's first. */
  layouts: readonly [Layout, Layout];

  /**
   * Lists a package's published files as repo-root paths, packing each
   * location at most once.
   */
  packedPaths: (location: PackLocation) => ReadonlySet<string>;

  /** The root manifest when the root is a package, else `undefined`. */
  root: Record<string, unknown> | undefined;
};

/** One revision's workspace, read once and shared by every question. */
type Layout = {
  /** Every workspace package's folder, excluding the root. */
  folders: readonly string[];

  /**
   * Whether the root is a package: the workspace has no `packages` key, as
   * Changesets decides, even when it lists no globs or matches no package.
   */
  isRootPackage: boolean;

  /** Reads and parses a manifest, caching it, or `undefined` if absent. */
  manifest: (file: string) => Record<string, unknown> | undefined;

  /** The parsed workspace file, empty when there is none. */
  workspace: Record<string, unknown>;
};

/** Where a package is, and where `pnpm pack` packs it from. */
type PackLocation = {
  /** The package's folder, or `.` for the root. */
  folder: string;

  /**
   * The folder pnpm packs: the package's own, or its
   * `publishConfig.directory`.
   */
  root: string;
};

/** A versioned package's name and the fields that change what it ships. */
type Shipped = {
  /** The fields that change what the package ships, catalogs resolved. */
  fields: Record<string, unknown>;

  /** The package's name. */
  name: string;
};

/** The dependency fields a consumer of a package installs. */
const DEPENDENCY_FIELDS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

/** Folders pnpm never looks for workspace packages in. */
const IGNORED_FOLDERS: ReadonlySet<string> = new Set([
  "bower_components",
  "node_modules",
]);

/**
 * Manifest fields, besides the dependencies and `engines`, that change what a
 * package's consumers get: its entry points, types, files, bundled and
 * optional peers, platforms, and the `publishConfig` that overrides them.
 */
const ENTRY_FIELDS = [
  "bin",
  "browser",
  "bundleDependencies",
  "bundledDependencies",
  "cpu",
  "exports",
  "files",
  "imports",
  "libc",
  "main",
  "module",
  "os",
  "peerDependenciesMeta",
  "publishConfig",
  "type",
  "types",
  "typings",
] as const;

/**
 * Root files that never ship with a root package, whatever pnpm packs: the
 * manifest, whose shipped fields are compared on their own, the workspace and
 * the lockfile.
 */
const ROOT_FILES_NOT_SHIPPED: ReadonlySet<string> = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
]);

/**
 * Root folders that never ship with a root package, whatever pnpm packs: the
 * pending changesets, such as the one the owner adds to a Renovate branch,
 * though not the Changesets config, and the repo's GitHub config.
 *
 * - Only a root package needs them set aside: in a monorepo, the root's files
 *   ship nothing already.
 */
const ROOT_FOLDERS_NOT_SHIPPED = [".changeset", ".github"] as const;

/** The workspace's file, which holds its package globs and catalogs. */
const WORKSPACE_FILE = "pnpm-workspace.yaml";

/**
 * Works out what a Renovate PR changes for the packages' consumers.
 *
 * - A package is versioned, as Changesets sees it, when it has a name and a
 *   version, isn't in the config's `ignore`, and is public or private while
 *   the config versions private packages; only a versioned package can be
 *   released.
 *
 * - A versioned package ships a change when its dependencies, `engines`,
 *   entry points or `files` change, a `catalog:` entry they point to
 *   included, or when a file it publishes changes: one `pnpm pack` lists,
 *   such as an action's `action.yml`.
 *
 * - A file the change deletes can't be packed, so it needs a changeset but no
 *   release, like a build config.
 *
 * - A package the PR deletes ships nothing, since no changeset can name it.
 *
 * - The root is a package only when the workspace has no `packages` key;
 *   then its files are judged like a workspace package's, except that the
 *   lockfile, workspace file, `.changeset/` and `.github/` ship nothing.
 *
 * - The Changesets config needs a changeset but no release, in either layout.
 *
 * - Any other file in a versioned package, such as a build config, needs a
 *   changeset but no release, since it may still change what ships.
 *
 * - A malformed manifest, workspace file or config, or a tree with neither
 *   root file, throws rather than answer "ships nothing", so a broken check
 *   never skips a changeset.
 *
 * @returns what the change needs: a release of each shipped package, or any
 *   changeset.
 */
export function analyzeRenovateChange({
  after,
  before,
  changedFiles,
  packFiles,
  parseYaml,
}: {
  /** The tree with the change, such as the PR's head. */
  after: Tree;

  /** The tree without it, such as the PR's merge base. */
  before: Tree;

  /** The paths the PR changes, relative to the repo root. */
  changedFiles: readonly string[];

  /** Lists a package's published files at the change's revision. */
  packFiles: PackFiles;

  /** The YAML parser for `pnpm-workspace.yaml`. */
  parseYaml: ParseYaml;
}): RenovateChange {
  if (!after.has("package.json") && !after.has(WORKSPACE_FILE)) {
    throw new Error(
      "Found neither package.json nor pnpm-workspace.yaml at the repo " +
        "root; the workspace must be at the root of the checkout."
    );
  }

  const layouts = [
    readLayout({ parseYaml, tree: after }),
    readLayout({ parseYaml, tree: before }),
  ] as const;
  const packed = new Map<string, ReadonlySet<string>>();
  const context: Context = {
    after,
    config: readChangesetConfig(after.read(CHANGESET_CONFIG)),
    folders: [...new Set(layouts.flatMap((layout) => layout.folders))],
    layouts,
    packedPaths: ({ folder, root }) => {
      // Keyed on both, though the root follows from the folder today, so a
      // caller that passes another root never gets stale paths.
      const key = `${folder}\0${root}`;
      const cached = packed.get(key);

      if (cached !== undefined) {
        return cached;
      }

      const paths = new Set(
        [...packFiles(folder)].map((file) => path.posix.join(root, file))
      );

      packed.set(key, paths);

      return paths;
    },
    root: layouts[0].isRootPackage
      ? layouts[0].manifest("package.json")
      : undefined,
  };
  const shipped = new Set<string>();
  let hasOtherChanges = false;

  for (const file of changedFiles) {
    const effect = fileEffect({ context, file });

    if (effect === "other") {
      hasOtherChanges = true;
    } else if (effect !== undefined) {
      shipped.add(effect);
    }
  }

  const doesTouchManifests = changedFiles.some((file) => isManifestFile(file));

  if (doesTouchManifests) {
    for (const name of shippedFieldChanges(context)) {
      shipped.add(name);
    }
  }

  return { hasOtherChanges, shippedPackages: [...shipped].sort() };
}

/**
 * Decides whether the analysis may read a file: a manifest, the workspace
 * file or the Changesets config, so a reader can fetch them all in one go and
 * refuse any other.
 *
 * @param file - the file's path, relative to the repo root.
 * @returns whether the analysis reads it.
 */
export function isAnalyzedFile(file: string): boolean {
  return isManifestFile(file) || file === CHANGESET_CONFIG;
}

/**
 * Decides whether a file is a manifest or the workspace file, whose changes
 * the shipped-field comparison reads.
 *
 * @param file - the file's path, relative to the repo root.
 * @returns whether it's a manifest or the workspace file.
 */
export function isManifestFile(file: string): boolean {
  return (
    file === WORKSPACE_FILE || path.posix.basename(file) === "package.json"
  );
}

/**
 * Reads a value as a plain object, where an absent one is empty.
 *
 * @returns the object.
 */
function asRecord({
  label,
  value,
}: {
  /** What the value is, for the error message. */
  label: string;

  /** The parsed value, such as a manifest's `dependencies`. */
  value: unknown;
}): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} isn't an object.`);
  }

  return Object.fromEntries(Object.entries(value));
}

/**
 * Reads a value as a list of strings, where an absent one is empty.
 *
 * @returns the strings.
 */
function asStrings({
  label,
  value,
}: {
  /** What the value is, for the error message. */
  label: string;

  /** The parsed value, such as the workspace's `packages`. */
  value: unknown;
}): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (
    !Array.isArray(value) ||
    !value.every((item): item is string => typeof item === "string")
  ) {
    throw new TypeError(`${label} isn't a list of strings.`);
  }

  return value;
}

/**
 * Works out what one changed file, other than a package's manifest, needs.
 *
 * @returns the name of the versioned package it ships with, `"other"` when it
 *   needs a changeset but no release, or `undefined` when it ships nothing.
 */
function fileEffect({
  context,
  file,
}: {
  /** What every changed file is judged against. */
  context: Context;

  /** The changed file's path. */
  file: string;
}): string | undefined {
  // The Changesets config ships nothing but changes what releases, so the
  // owner decides, as for a build config, whatever the layout.
  if (file === CHANGESET_CONFIG) {
    return "other";
  }

  // A package's own manifest is compared apart, even a deleted one.
  if (
    path.posix.basename(file) === "package.json" &&
    context.folders.includes(path.posix.dirname(file))
  ) {
    return undefined;
  }

  const holders = context.folders
    .filter((folder) => file.startsWith(`${folder}/`))
    .sort((left, right) => right.length - left.length);

  // The deepest package still at the head owns the file, so one left behind
  // by a deleted nested package falls to the package around it.
  const [owner] = holders.flatMap((folder) => {
    const manifest = context.layouts[0].manifest(`${folder}/package.json`);

    return manifest === undefined ? [] : [{ folder, manifest }];
  });

  // A file whose every package the PR deletes ships nothing, since no
  // changeset can name them.
  if (owner === undefined && holders.length > 0) {
    return undefined;
  }

  if (owner !== undefined) {
    const name = versionedName({
      config: context.config,
      manifest: owner.manifest,
    });

    if (name === undefined) {
      return "other";
    }

    // A file the package may not publish, such as a build config, still
    // needs a changeset, so the owner decides as on any PR.
    return isPublished({
      context,
      file,
      folder: owner.folder,
      manifest: owner.manifest,
    })
      ? name
      : "other";
  }

  const { root } = context;

  if (
    root === undefined ||
    ROOT_FILES_NOT_SHIPPED.has(file) ||
    ROOT_FOLDERS_NOT_SHIPPED.some((folder) => file.startsWith(`${folder}/`))
  ) {
    return undefined;
  }

  const name = versionedName({ config: context.config, manifest: root });

  return name !== undefined &&
    isPublished({ context, file, folder: ".", manifest: root })
    ? name
    : "other";
}

/**
 * Decides whether a changed file is published with its package: it's still
 * there, and `pnpm pack` lists it.
 *
 * - A deleted file is never packed, so it's left to the owner.
 *
 * - With `publishConfig.directory`, pnpm packs that folder instead, so a
 *   file outside it never ships, and is decided without packing: that folder
 *   may not be built yet, which makes `pnpm pack` fail.
 *
 * - A `publishConfig.directory` outside the package, or absolute, can't be
 *   matched against its files, so every file of the package ships, rather
 *   than let a published change through.
 *
 * - A changed submodule ships, such as on a bump from Renovate's submodule
 *   manager, since a checkout that skips submodules leaves pnpm nothing to
 *   list inside it.
 *
 * @returns whether the file ships.
 */
function isPublished({
  context,
  file,
  folder,
  manifest,
}: {
  /** What every changed file is judged against. */
  context: Context;

  /** The file's path, relative to the repo root. */
  file: string;

  /** The package's folder, or `.` for the root. */
  folder: string;

  /** The package's manifest, for its `publishConfig.directory`. */
  manifest: Record<string, unknown>;
}): boolean {
  if (!context.after.has(file)) {
    return false;
  }

  const root = packRoot({ folder, manifest });

  // A submodule's files are missing from a checkout that skips submodules,
  // as `actions/checkout` does by default, so pnpm can't say; a bump counts
  // as shipped rather than let a published change through.
  if (root === undefined || context.after.isSubmodule(file)) {
    return true;
  }

  if (root !== "." && !file.startsWith(`${root}/`)) {
    return false;
  }

  return context.packedPaths({ folder, root }).has(file);
}

/**
 * Lists the workspace's package folders, excluding the root, by matching each
 * folder holding a `package.json` against the workspace's globs, skipping the
 * folders pnpm skips.
 *
 * @returns each folder, such as `packages/a`.
 */
function listPackageFolders({
  tree,
  workspace,
}: {
  /** The tree to list. */
  tree: Tree;

  /** The parsed workspace file. */
  workspace: Record<string, unknown>;
}): string[] {
  const globs = asStrings({
    label: `${WORKSPACE_FILE}'s packages`,
    value: workspace.packages,
  }).map((glob) => normalizeGlob(glob));
  const includes = globs.filter((glob) => !glob.startsWith("!"));
  const excludes = globs
    .filter((glob) => glob.startsWith("!"))
    .map((glob) => glob.slice(1));

  return tree
    .list()
    .filter((file) => path.posix.basename(file) === "package.json")
    .map((file) => path.posix.dirname(file))
    .filter(
      (folder) =>
        folder !== "." &&
        !folder.split("/").some((part) => IGNORED_FOLDERS.has(part)) &&
        includes.some((glob) => path.posix.matchesGlob(folder, glob)) &&
        !excludes.some((glob) => path.posix.matchesGlob(folder, glob))
    );
}

/**
 * Writes a glob or path the way `matchesGlob` reads paths: without a leading
 * `./` or `/`, or a trailing `/`, all of which pnpm and npm accept.
 *
 * @param glob - the glob as written, such as `!./packages/*` or `apps/web/`.
 * @returns the glob, such as `!packages/*`.
 */
function normalizeGlob(glob: string): string {
  const isExclude = glob.startsWith("!");
  const body = (isExclude ? glob.slice(1) : glob)
    .replace(/^(?:\.?\/)+/u, "")
    .replace(/\/+$/u, "");

  return isExclude ? `!${body}` : body;
}

/**
 * Finds the folder `pnpm pack` packs a package from: its
 * `publishConfig.directory`, under the package's folder, or else the folder
 * itself.
 *
 * @returns the folder, relative to the repo root, such as `packages/a/lib`,
 *   or `.` for the root; `undefined` for a directory that's absolute or
 *   climbs out of the package's folder.
 */
function packRoot({
  folder,
  manifest,
}: {
  /** The package's folder, or `.` for the root. */
  folder: string;

  /** The package's manifest. */
  manifest: Record<string, unknown>;
}): string | undefined {
  // A malformed `publishConfig` throws, as any malformed manifest does,
  // rather than answer that nothing ships.
  const { directory } = asRecord({
    label: "a package.json's publishConfig",
    value: manifest.publishConfig,
  });

  if (typeof directory !== "string") {
    return folder;
  }

  // `join` keeps a trailing slash, as in `./lib/`, which pnpm accepts.
  const root = path.posix.join(folder, directory).replace(/(?<=.)\/+$/u, "");
  const inside = path.posix.relative(folder, root);

  return path.posix.isAbsolute(directory) ||
    inside === ".." ||
    inside.startsWith("../")
    ? undefined
    : root;
}

/**
 * Reads one revision's workspace file and package folders, and reads each
 * manifest at most once.
 *
 * @returns the revision's layout.
 */
function readLayout({
  parseYaml,
  tree,
}: {
  /** The YAML parser. */
  parseYaml: ParseYaml;

  /** The revision's files. */
  tree: Tree;
}): Layout {
  const workspaceText = tree.read(WORKSPACE_FILE);
  const workspace =
    workspaceText === undefined
      ? {}
      : asRecord({ label: WORKSPACE_FILE, value: parseYaml(workspaceText) });
  const folders = listPackageFolders({ tree, workspace });
  const manifests = new Map<string, Record<string, unknown> | undefined>();

  return {
    folders,
    isRootPackage:
      workspace.packages === undefined || workspace.packages === null,
    manifest: (file) => {
      if (!manifests.has(file)) {
        const text = tree.read(file);

        manifests.set(
          file,
          text === undefined
            ? undefined
            : asRecord({ label: file, value: JSON.parse(text) })
        );
      }

      return manifests.get(file);
    },
    workspace,
  };
}

/**
 * Resolves a dependency spec, replacing a `catalog:` spec with the catalog's
 * entry, so a catalog bump shows as a change.
 *
 * @returns the spec, or `{ catalog: <entry> }` for a catalog spec.
 */
function resolveSpec({
  name,
  spec,
  workspace,
}: {
  /** The dependency's name. */
  name: string;

  /** The spec as written, such as `^1.0.0` or `catalog:`. */
  spec: unknown;

  /** The parsed workspace file. */
  workspace: Record<string, unknown>;
}): unknown {
  if (typeof spec !== "string" || !spec.startsWith("catalog:")) {
    return spec;
  }

  const catalogName = spec.slice("catalog:".length);
  const catalogs = asRecord({
    label: `${WORKSPACE_FILE}'s catalogs`,
    value: workspace.catalogs,
  });

  if (catalogName === "" || catalogName === "default") {
    const defaultCatalog = asRecord({
      label: `${WORKSPACE_FILE}'s catalog`,
      value: workspace.catalog,
    });
    const namedDefault = asRecord({
      label: `${WORKSPACE_FILE}'s default catalog`,
      value: catalogs.default,
    });

    return { catalog: defaultCatalog[name] ?? namedDefault[name] ?? null };
  }

  const catalog = asRecord({
    label: `${WORKSPACE_FILE}'s ${catalogName} catalog`,
    value: catalogs[catalogName],
  });

  return { catalog: catalog[name] ?? null };
}

/**
 * Lists the versioned packages at the change's revision whose shipped fields
 * differ from the base's, a new package included; a deleted one ships
 * nothing.
 *
 * @param context - what the change is judged against.
 * @returns each package's name.
 */
function shippedFieldChanges(context: Context): string[] {
  const [after, before] = context.layouts;
  const afterShipped = snapshot({ config: context.config, layout: after });
  const beforeShipped = snapshot({ config: context.config, layout: before });

  return [...afterShipped]
    .filter(
      ([file, entry]) =>
        !isDeepStrictEqual(beforeShipped.get(file)?.fields, entry.fields)
    )
    .map(([_file, entry]) => entry.name);
}

/**
 * Picks a manifest's shipped fields, with catalog specs resolved.
 *
 * @returns the dependency fields, `engines` and each entry-point field.
 */
function shippedFields({
  file,
  manifest,
  workspace,
}: {
  /** The manifest's path, for error messages. */
  file: string;

  /** The parsed manifest. */
  manifest: Record<string, unknown>;

  /** The parsed workspace file. */
  workspace: Record<string, unknown>;
}): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    engines: asRecord({ label: `${file}'s engines`, value: manifest.engines }),
  };

  for (const field of DEPENDENCY_FIELDS) {
    const specs = asRecord({
      label: `${file}'s ${field}`,
      value: manifest[field],
    });

    fields[field] = Object.fromEntries(
      Object.entries(specs).map(([name, spec]) => [
        name,
        resolveSpec({ name, spec, workspace }),
      ])
    );
  }

  for (const field of ENTRY_FIELDS) {
    fields[field] = manifest[field] ?? null;
  }

  return fields;
}

/**
 * Collects every versioned package's shipped fields at one revision.
 *
 * @returns each package's name and fields, keyed by manifest path.
 */
function snapshot({
  config,
  layout,
}: {
  /** The Changesets config. */
  config: ChangesetConfig;

  /** The revision's layout. */
  layout: Layout;
}): Map<string, Shipped> {
  const files = [
    ...(layout.isRootPackage ? ["package.json"] : []),
    ...layout.folders.map((folder) => `${folder}/package.json`),
  ];
  const shipped = new Map<string, Shipped>();

  for (const file of files) {
    const manifest = layout.manifest(file);

    if (manifest === undefined) {
      continue;
    }

    const name = versionedName({ config, manifest });

    if (name !== undefined) {
      shipped.set(file, {
        fields: shippedFields({
          file,
          manifest,
          workspace: layout.workspace,
        }),
        name,
      });
    }
  }

  return shipped;
}

/**
 * Names a package Changesets versions, by its own rules: it has a name and a
 * version, isn't in the config's `ignore`, and is public or private while
 * private packages are versioned.
 *
 * @returns the package's name, or `undefined` when it isn't versioned.
 */
function versionedName({
  config,
  manifest,
}: {
  /** The Changesets config. */
  config: ChangesetConfig;

  /** The package's manifest. */
  manifest: Record<string, unknown>;
}): string | undefined {
  const name = typeof manifest.name === "string" ? manifest.name : undefined;
  const isVersioned = isReleased({
    config,
    isPrivate: manifest.private === true,
    name,
    version:
      typeof manifest.version === "string" ? manifest.version : undefined,
  });

  return isVersioned ? name : undefined;
}
