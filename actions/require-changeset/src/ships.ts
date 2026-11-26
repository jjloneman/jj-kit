import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { ChangesetConfig } from "../../lib/src/changeset-config.ts";

import {
  CHANGESET_CONFIG,
  isReleased,
  readChangesetConfig,
} from "../../lib/src/changeset-config.ts";

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
  /** Every file path in the revision, relative to the repo root. */
  list: () => readonly string[];

  /** A file's text, or `undefined` when the revision has no such file. */
  read: (file: string) => string | undefined;
};

/** What every changed file is judged against, worked out once. */
type Context = {
  /** The Changesets config. */
  config: ChangesetConfig;

  /** Every workspace package's folder, at either revision. */
  folders: readonly string[];

  /** Both revisions' layouts, the change's first. */
  layouts: readonly [Layout, Layout];

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

/** Files npm packs whatever `files` says, matched by name at the top. */
const ALWAYS_PACKED = /^(?:readme|licen[cs]e)(?:\..*)?$/iu;

/**
 * Root files that never ship with a root package that lists no `files`: the
 * manifest, whose shipped fields are compared on their own, the workspace and
 * the lockfile.
 */
const ROOT_FILES_NOT_SHIPPED: ReadonlySet<string> = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
]);

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
 *   included, or when a file it publishes changes: one its `files` list
 *   includes, or any file when it has none, such as an action's
 *   `action.yml`.
 *
 * - A package the PR deletes ships nothing, since no changeset can name it.
 *
 * - The root is a package only when the workspace has no `packages` key;
 *   then its files are judged like a workspace package's, except that the
 *   lockfile, workspace file and `.github/` ship nothing.
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
  parseYaml,
}: {
  /** The tree with the change, such as the PR's head. */
  after: Tree;

  /** The tree without it, such as the PR's merge base. */
  before: Tree;

  /** The paths the PR changes, relative to the repo root. */
  changedFiles: readonly string[];

  /** The YAML parser for `pnpm-workspace.yaml`. */
  parseYaml: ParseYaml;
}): RenovateChange {
  const afterFiles = new Set(after.list());

  if (!afterFiles.has("package.json") && !afterFiles.has(WORKSPACE_FILE)) {
    throw new Error(
      "Found neither package.json nor pnpm-workspace.yaml at the repo " +
        "root; the workspace must be at the root of the checkout."
    );
  }

  const layouts = [
    readLayout({ parseYaml, tree: after }),
    readLayout({ parseYaml, tree: before }),
  ] as const;
  const context: Context = {
    config: readChangesetConfig(after.read(CHANGESET_CONFIG)),
    folders: [...new Set(layouts.flatMap((layout) => layout.folders))],
    layouts,
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

  const doesTouchManifests = changedFiles.some(
    (file) =>
      file === WORKSPACE_FILE || path.posix.basename(file) === "package.json"
  );

  if (doesTouchManifests) {
    for (const name of shippedFieldChanges(context)) {
      shipped.add(name);
    }
  }

  return { hasOtherChanges, shippedPackages: [...shipped].sort() };
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
  const owner = context.folders
    .filter((folder) => file.startsWith(`${folder}/`))
    .reduce<string | undefined>(
      (deepest, folder) =>
        deepest === undefined || folder.length > deepest.length
          ? folder
          : deepest,
      undefined
    );

  if (owner !== undefined) {
    const manifestFile = `${owner}/package.json`;
    const manifest = context.layouts[0].manifest(manifestFile);

    // A deleted package ships nothing; its own manifest is compared apart.
    if (file === manifestFile || manifest === undefined) {
      return undefined;
    }

    const name = versionedName({ config: context.config, manifest });

    if (name === undefined) {
      return "other";
    }

    // A file the package may not publish, such as a build config, still
    // needs a changeset, so the owner decides as on any PR.
    return isPublished({ file: file.slice(owner.length + 1), manifest })
      ? name
      : "other";
  }

  const { root } = context;

  if (
    root === undefined ||
    ROOT_FILES_NOT_SHIPPED.has(file) ||
    file.startsWith(".github/")
  ) {
    return undefined;
  }

  const name = versionedName({ config: context.config, manifest: root });

  return name !== undefined && isPublished({ file, manifest: root })
    ? name
    : "other";
}

/**
 * Decides whether npm publishes a file with its package.
 *
 * - With no `files` list, every file is published.
 *
 * - Otherwise, an empty one included, a file is published when the list
 *   includes it, or when npm packs it anyway: a top-level README or license,
 *   or the `main` or a `bin` target.
 *
 * @returns whether the file is in the published package.
 */
function isPublished({
  file,
  manifest,
}: {
  /** The file's path, relative to the package's folder. */
  file: string;

  /** The package's manifest. */
  manifest: Record<string, unknown>;
}): boolean {
  const patterns = asStrings({
    label: "a package.json's files",
    value: manifest.files,
  });

  if (manifest.files === undefined || manifest.files === null) {
    return true;
  }

  const bin = manifest.bin;
  const targets = [
    manifest.main,
    ...(typeof bin === "string"
      ? [bin]
      : Object.values(asRecord({ label: "a package.json's bin", value: bin }))),
  ]
    .filter((target): target is string => typeof target === "string")
    .map((target) => normalizeGlob(target));

  return (
    (!file.includes("/") && ALWAYS_PACKED.test(file)) ||
    targets.includes(file) ||
    matchesFiles({ file, patterns })
  );
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
 * Matches a file against a manifest's `files` list, where an entry names a
 * file, a folder holding it, or a glob, and a `!` entry excludes.
 *
 * @returns whether the list includes the file.
 */
function matchesFiles({
  file,
  patterns,
}: {
  /** The file's path, relative to the package's folder. */
  file: string;

  /** The manifest's `files` entries. */
  patterns: readonly string[];
}): boolean {
  const normalized = patterns.map((pattern) => normalizeGlob(pattern));

  const parts = file.split("/");
  const ancestors = parts
    .slice(1)
    .map((_part, index) => parts.slice(0, index + 1).join("/"));

  /**
   * Matches the file against one entry, as itself or as a folder holding it,
   * at any depth; matching its folders, not `<entry>/**`, keeps dotfiles in,
   * as npm does.
   *
   * @param pattern - the entry, without `!`.
   * @returns whether the file is under it.
   */
  function isUnder(pattern: string): boolean {
    return [file, ...ancestors].some((candidate) =>
      path.posix.matchesGlob(candidate, pattern)
    );
  }

  return (
    normalized.some(
      (pattern) => !pattern.startsWith("!") && isUnder(pattern)
    ) &&
    !normalized.some(
      (pattern) => pattern.startsWith("!") && isUnder(pattern.slice(1))
    )
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
    isPrivateAllowed: config.isPrivateVersioned,
    name,
    version:
      typeof manifest.version === "string" ? manifest.version : undefined,
  });

  return isVersioned ? name : undefined;
}
