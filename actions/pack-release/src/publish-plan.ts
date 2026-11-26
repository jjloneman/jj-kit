/** One entry in `changeset publish-plan`'s plan. */
export type PublishEntry = {
  /** `publish` for an npm publish, or `tag-only` for a git tag alone. */
  kind: "publish" | "tag-only";

  /** The package's name. */
  name: string;

  /** The version it publishes or tags. */
  version: string;
};

/** A publish plan with its `0.0.0` entries held back. */
export type PublishPlan = {
  /** The entries to publish or tag, in the plan's order. */
  entries: readonly PublishEntry[];

  /**
   * The entries held back: each at `0.0.0`, which no version PR has bumped
   * yet, and each that depends on one.
   */
  held: readonly PublishEntry[];

  /**
   * The plan without the held entries, as JSON in the format it came in, for
   * `changeset pack --from-publish-plan`.
   */
  text: string;
};

/** The only plan format `changeset pack` and `changeset publish` read. */
const PLAN_FORMAT = 1;

/** The version a package has until its first version PR bumps it. */
const UNRELEASED_VERSION = "0.0.0";

/**
 * Parses the file `changeset publish-plan --output` writes, a `version` and
 * a `plan` of chunks in dependency order, and holds back each entry at
 * `0.0.0`, and each that depends on a held one, directly or not.
 *
 * - A dependent is held too, or it would publish needing a version that was
 *   never released, and fail to install.
 *
 * - Any other format throws, since `--output` is experimental as of
 *   `@changesets/cli` 3.0.3 and may change between minors.
 *
 * - The kept entries keep every field Changesets wrote, such as `access` and
 *   `tag`, and a chunk left empty is dropped.
 *
 * @returns the kept and held entries, and the kept plan's JSON.
 */
export function splitPublishPlan({
  dependenciesOf,
  text,
}: {
  /**
   * Reads which packages each package installs with it, called only when an
   * entry is at `0.0.0`.
   */
  dependenciesOf: () => ReadonlyMap<string, readonly string[]>;

  /** The file's JSON text. */
  text: string;
}): PublishPlan {
  const parsed: unknown = JSON.parse(text);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    parsed.version !== PLAN_FORMAT
  ) {
    throw new TypeError(
      `The publish plan isn't format ${String(PLAN_FORMAT)}, the only one ` +
        "the actions read."
    );
  }

  if (!("plan" in parsed) || !Array.isArray(parsed.plan)) {
    throw new TypeError("The publish plan has no list of chunks.");
  }

  const chunks = parsed.plan.map((chunk: unknown) => {
    if (!Array.isArray(chunk)) {
      throw new TypeError("The publish plan has a chunk that isn't a list.");
    }

    return chunk.map((raw: unknown) => ({ entry: parseEntry(raw), raw }));
  });
  const all = chunks.flat();
  const heldNames = holdBack({
    dependenciesOf,
    entries: all.map(({ entry }) => entry),
  });
  const isHeld = (entry: PublishEntry): boolean => heldNames.has(entry.name);
  const entries = all
    .map(({ entry }) => entry)
    .filter((entry) => !isHeld(entry));
  const held = all.map(({ entry }) => entry).filter((entry) => isHeld(entry));
  const kept = chunks
    .map((chunk) =>
      chunk.filter(({ entry }) => !isHeld(entry)).map(({ raw }) => raw)
    )
    .filter((chunk) => chunk.length > 0);

  return {
    entries,
    held,
    text: JSON.stringify({ plan: kept, version: PLAN_FORMAT }, undefined, 2),
  };
}

/**
 * Works out which entries to hold back: each at `0.0.0`, then each that
 * depends on a held one, until none is added.
 *
 * @returns the held entries' names.
 */
function holdBack({
  dependenciesOf,
  entries,
}: {
  /** Reads which packages each package installs with it. */
  dependenciesOf: () => ReadonlyMap<string, readonly string[]>;

  /** Every entry in the plan. */
  entries: readonly PublishEntry[];
}): Set<string> {
  const held = new Set(
    entries
      .filter((entry) => entry.version === UNRELEASED_VERSION)
      .map((entry) => entry.name)
  );

  if (held.size === 0) {
    return held;
  }

  const dependencies = dependenciesOf();
  let isGrowing = true;

  while (isGrowing) {
    const added = entries.filter(
      (entry) =>
        !held.has(entry.name) &&
        (dependencies.get(entry.name) ?? []).some((name) => held.has(name))
    );

    for (const entry of added) {
      held.add(entry.name);
    }

    isGrowing = added.length > 0;
  }

  return held;
}

/**
 * Parses one entry of the publish plan.
 *
 * @param entry - the entry as JSON gave it.
 * @returns the entry.
 */
function parseEntry(entry: unknown): PublishEntry {
  if (
    typeof entry !== "object" ||
    entry === null ||
    !("kind" in entry) ||
    (entry.kind !== "publish" && entry.kind !== "tag-only") ||
    !("name" in entry) ||
    typeof entry.name !== "string" ||
    !("version" in entry) ||
    typeof entry.version !== "string"
  ) {
    throw new TypeError(
      "The publish plan has an entry without a known kind, a name and a " +
        "version."
    );
  }

  return { kind: entry.kind, name: entry.name, version: entry.version };
}
