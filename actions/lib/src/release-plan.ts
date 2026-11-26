/** One changeset in a release plan. */
export type Changeset = {
  /** Its file name without `.md`, such as `brave-cats-dance`. */
  id: string;

  /** The packages it releases, empty for an empty changeset. */
  releases: readonly unknown[];
};

/** One package release in a release plan. */
export type Release = {
  /** The released package's name. */
  name: string;

  /** The bump, such as `minor`, or `none` for a package named but unbumped. */
  type: string;
};

/**
 * The parts of `changeset status --output`'s release plan the actions read.
 *
 * - `changesets` holds the changesets pending, or, with `--since`, the ones
 *   the PR added or edited, read by changesets' own rules.
 *
 * - `releases` holds the package bumps they add up to.
 */
export type ReleasePlan = {
  /** The changesets. */
  changesets: readonly Changeset[];

  /** The package releases those changesets make. */
  releases: readonly Release[];
};

/**
 * Parses the file `changeset status --output` writes.
 *
 * - A changeset's id must be a plain file name, or one under `pre/` as
 *   Changesets names pre-release changesets, since the actions build a path
 *   from it.
 *
 * @param text - the file's JSON text.
 * @returns the release plan.
 */
export function parseReleasePlan(text: string): ReleasePlan {
  const parsed: unknown = JSON.parse(text);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("changesets" in parsed) ||
    !("releases" in parsed) ||
    !Array.isArray(parsed.changesets) ||
    !Array.isArray(parsed.releases) ||
    !parsed.changesets.every((changeset: unknown) => isChangeset(changeset)) ||
    !parsed.releases.every((release: unknown) => isRelease(release))
  ) {
    throw new TypeError(
      "changeset status wrote no `changesets` and `releases` lists of the " +
        "expected shape."
    );
  }

  return { changesets: parsed.changesets, releases: parsed.releases };
}

/**
 * Checks a release plan's changeset: a plain id and a list of releases.
 *
 * @param changeset - one entry of the plan's `changesets`.
 * @returns whether it has that shape.
 */
function isChangeset(changeset: unknown): changeset is Changeset {
  return (
    typeof changeset === "object" &&
    changeset !== null &&
    "id" in changeset &&
    "releases" in changeset &&
    typeof changeset.id === "string" &&
    isPlainId(changeset.id.replace(/^pre\//u, "")) &&
    Array.isArray(changeset.releases)
  );
}

/**
 * Checks that an id is a plain file name, so a path built from it stays in
 * its folder.
 *
 * @param id - the id, without a `pre/` prefix.
 * @returns whether it's non-empty, not `.` or `..`, and has no slash.
 */
function isPlainId(id: string): boolean {
  return id !== "" && id !== "." && id !== ".." && !/[/\\]/u.test(id);
}

/**
 * Checks a release plan's release: a package name and a bump type.
 *
 * @param release - one entry of the plan's `releases`.
 * @returns whether it has that shape.
 */
function isRelease(release: unknown): release is Release {
  return (
    typeof release === "object" &&
    release !== null &&
    "name" in release &&
    "type" in release &&
    typeof release.name === "string" &&
    typeof release.type === "string"
  );
}
