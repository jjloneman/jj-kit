import path from "node:path";

import type { ChangesetConfig } from "../../lib/src/changeset-config.ts";
import type { Changeset } from "../../lib/src/release-plan.ts";

import { isReleased } from "../../lib/src/changeset-config.ts";

/** What to do with the pending changesets before `changesets/action` runs. */
export type SetAsideDecision = {
  /** The ids of the changesets to delete from this run's checkout. */
  ids: readonly string[];

  /** Why, for the run's log. */
  reason: string;

  /**
   * Whether the run should show the reason as a notice: when it sets
   * changesets aside, or holds back for a package at `0.0.0`.
   */
  shouldAnnotate: boolean;
};

/** One workspace package, as `pnpm -r ls --json` lists it. */
type WorkspacePackage = {
  /** Whether it's private, so never published. */
  isPrivate: boolean;

  /** Its name, or `undefined` when it has none. */
  name: string | undefined;

  /** Its folder's absolute path. */
  path: string;

  /** Its version, or `undefined` when it has none, as a private root may. */
  version: string | undefined;
};

/** The version a package has until its first version PR bumps it. */
const UNRELEASED_VERSION = "0.0.0";

/**
 * Decides whether to set aside the pending changesets, so `changesets/action`
 * takes its publish path instead of doing nothing.
 *
 * - Only when every pending changeset is empty: with none pending it already
 *   publishes, and with a releasing one the version PR comes first.
 *
 * - Never while a package the publish would release is at `0.0.0`, which no
 *   version PR has bumped yet: a public one, or a private one when private
 *   packages are tagged, but not one the config's `ignore` names, which
 *   Changesets never releases.
 *
 * @returns the changesets to delete, and why.
 */
export function decideSetAside({
  changesets,
  config,
  packages,
}: {
  /** The pending changesets. */
  changesets: readonly Changeset[];

  /** The Changesets config, for `ignore` and `privatePackages.tag`. */
  config: ChangesetConfig;

  /** The workspace's packages, without the root of a monorepo. */
  packages: readonly WorkspacePackage[];
}): SetAsideDecision {
  if (changesets.length === 0) {
    return {
      ids: [],
      reason: "No changeset is pending.",
      shouldAnnotate: false,
    };
  }

  if (changesets.some((changeset) => changeset.releases.length > 0)) {
    return {
      ids: [],
      reason:
        "A pending changeset releases a package, so it waits for the " +
        "version PR.",
      shouldAnnotate: false,
    };
  }

  const unreleased = packages.flatMap(({ isPrivate, name, version }) =>
    version === UNRELEASED_VERSION &&
    name !== undefined &&
    isReleased({
      config,
      isPrivate,
      isPrivateAllowed: config.isPrivateTagged,
      name,
      version,
    })
      ? [name]
      : []
  );

  if (unreleased.length > 0) {
    return {
      ids: [],
      reason:
        `Every pending changeset is empty, but ${unreleased.join(", ")} ` +
        `is still at ${UNRELEASED_VERSION}, so nothing is released until ` +
        "its version PR.",
      shouldAnnotate: true,
    };
  }

  return {
    ids: changesets.map((changeset) => changeset.id),
    reason:
      "Every pending changeset is empty, so this run publishes anything npm " +
      "doesn't have yet.",
    shouldAnnotate: true,
  };
}

/**
 * Reads the workspace's packages from `pnpm -r ls --depth -1 --json`, leaving
 * out a monorepo's root, which Changesets never releases.
 *
 * - With only the root listed, the repo is a single package, so it stays.
 *
 * @returns each package.
 */
export function parseWorkspacePackages({
  rootDir,
  text,
}: {
  /** The workspace root's real path, compared after resolving both. */
  rootDir: string;

  /** pnpm's JSON output. */
  text: string;
}): WorkspacePackage[] {
  const parsed: unknown = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new TypeError("pnpm listed no packages.");
  }

  const entries = parsed.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("path" in entry) ||
      typeof entry.path !== "string"
    ) {
      throw new TypeError("pnpm listed a package without a path.");
    }

    return {
      isPrivate: "private" in entry && entry.private === true,
      name:
        "name" in entry && typeof entry.name === "string"
          ? entry.name
          : undefined,
      path: entry.path,
      version:
        "version" in entry && typeof entry.version === "string"
          ? entry.version
          : undefined,
    };
  });

  const root = path.resolve(rootDir);

  return entries.filter(
    (entry) => entries.length === 1 || path.resolve(entry.path) !== root
  );
}
