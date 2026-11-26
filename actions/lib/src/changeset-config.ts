import path from "node:path";

/** The Changesets config settings the actions read. */
export type ChangesetConfig = {
  /** The package names or globs Changesets never releases, its `ignore`. */
  ignore: readonly string[];

  /** Whether a release tags private packages, `privatePackages.tag`. */
  isPrivateTagged: boolean;

  /** Whether changesets version private packages, `privatePackages.version`. */
  isPrivateVersioned: boolean;
};

/** The Changesets config's path, relative to the repo root. */
export const CHANGESET_CONFIG = ".changeset/config.json";

/**
 * Decides whether the config's `ignore` names a package, as Changesets reads
 * it: an entry is a name or a glob, and a `!` entry takes a name back out,
 * applied in order, so a later entry can ignore it again.
 *
 * @returns whether the last entry to match the name ignores it.
 */
export function isIgnored({
  config,
  name,
}: {
  /** The Changesets config. */
  config: ChangesetConfig;

  /** The package's name. */
  name: string;
}): boolean {
  /**
   * Matches the name against one entry, without its `!`.
   *
   * @param pattern - a name or a glob.
   * @returns whether the name matches.
   */
  function matches(pattern: string): boolean {
    return path.posix.matchesGlob(name, pattern);
  }

  return config.ignore.reduce(
    (isMatched, pattern) =>
      pattern.startsWith("!")
        ? isMatched && !matches(pattern.slice(1))
        : isMatched || matches(pattern),
    false
  );
}

/**
 * Decides whether Changesets releases a package, by its own skip rule: it has
 * a name and a version, isn't in the config's `ignore`, and is public, or
 * private while `isPrivateAllowed` is on.
 *
 * @returns whether Changesets releases the package.
 */
export function isReleased({
  config,
  isPrivate,
  isPrivateAllowed,
  name,
  version,
}: {
  /** The Changesets config. */
  config: ChangesetConfig;

  /** Whether the package is private. */
  isPrivate: boolean;

  /**
   * Whether private packages count: `isPrivateVersioned` for versioning,
   * `isPrivateTagged` for tagging.
   */
  isPrivateAllowed: boolean;

  /** The package's name, or `undefined` when it has none. */
  name: string | undefined;

  /** The package's version, or `undefined` when it has none. */
  version: string | undefined;
}): boolean {
  return (
    name !== undefined &&
    name !== "" &&
    version !== undefined &&
    version !== "" &&
    (!isPrivate || isPrivateAllowed) &&
    !isIgnored({ config, name })
  );
}

/**
 * Reads the Changesets config's `ignore` and `privatePackages`, with
 * Changesets' defaults when either, or the whole config, is absent.
 *
 * - `privatePackages` of `true` or `false` sets both flags; an object sets
 *   each on its own.
 *
 * @param text - the config's JSON text, or `undefined` when there is none.
 * @returns the settings.
 */
export function readChangesetConfig(text: string | undefined): ChangesetConfig {
  const config: unknown = text === undefined ? {} : JSON.parse(text);
  const record = typeof config === "object" && config !== null ? config : {};
  const value = "privatePackages" in record ? record.privatePackages : false;
  const ignore = "ignore" in record ? record.ignore : [];

  if (
    !Array.isArray(ignore) ||
    !ignore.every((entry): entry is string => typeof entry === "string")
  ) {
    throw new TypeError(`${CHANGESET_CONFIG}'s ignore isn't valid.`);
  }

  if (typeof value === "boolean") {
    return { ignore, isPrivateTagged: value, isPrivateVersioned: value };
  }

  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${CHANGESET_CONFIG}'s privatePackages isn't valid.`);
  }

  return {
    ignore,
    isPrivateTagged: "tag" in value && value.tag === true,
    isPrivateVersioned: "version" in value && value.version === true,
  };
}
