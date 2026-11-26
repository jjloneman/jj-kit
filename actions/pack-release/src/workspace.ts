/** Dependency fields whose packages a consumer installs with the package. */
const DEPENDENCY_FIELDS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

/**
 * Reads which packages each workspace package installs with it, from the
 * listing `pnpm -r ls --depth -1 --json` prints and each package's manifest.
 *
 * - Dev dependencies are left out, since a consumer never installs them.
 *
 * @returns each package's name, mapped to the names it depends on.
 */
export function readDependencies({
  listing,
  readManifest,
}: {
  /** pnpm's JSON listing of the workspace's packages. */
  listing: string;

  /** Reads the `package.json` in a package's folder. */
  readManifest: (folder: string) => string;
}): Map<string, string[]> {
  const parsed: unknown = JSON.parse(listing);

  if (!Array.isArray(parsed)) {
    throw new TypeError("pnpm listed no packages.");
  }

  const entries: readonly unknown[] = parsed;
  const dependencies = new Map<string, string[]>();

  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("path" in entry) ||
      typeof entry.path !== "string"
    ) {
      throw new TypeError("pnpm listed a package without a path.");
    }

    const manifest: unknown = JSON.parse(readManifest(entry.path));

    if (
      typeof manifest === "object" &&
      manifest !== null &&
      "name" in manifest &&
      typeof manifest.name === "string"
    ) {
      dependencies.set(manifest.name, dependencyNames(manifest));
    }
  }

  return dependencies;
}

/**
 * Lists the names in a manifest's installed dependency fields.
 *
 * @param manifest - the parsed `package.json`.
 * @returns the names, possibly repeated across fields.
 */
function dependencyNames(manifest: object): string[] {
  return DEPENDENCY_FIELDS.flatMap((field) => {
    const value: unknown =
      field in manifest ? Reflect.get(manifest, field) : {};

    return typeof value === "object" && value !== null
      ? Object.keys(value)
      : [];
  });
}
