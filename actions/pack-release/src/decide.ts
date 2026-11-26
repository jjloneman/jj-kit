import type { Changeset } from "../../lib/src/release-plan.ts";
import type { PublishEntry, PublishPlan } from "./publish-plan.ts";

/** A publish plan as `decideRelease` reads it, with where it was kept. */
export type ReadPlan = {
  /** The kept plan's file, for the pack step. */
  file: string;
} & Pick<PublishPlan, "entries" | "held">;

/** What the release run does next, and why. */
export type ReleaseDecision = {
  /**
   * `version` to open or update the version PR, `publish` to publish and tag
   * the plan's kept entries, or `none` when there's nothing to do.
   */
  next: "none" | "publish" | "version";

  /**
   * The kept plan's file, for the pack step to upload, or empty when the plan
   * wasn't read.
   */
  planFile: string;

  /** Why, for the run's log. */
  reason: string;

  /** Whether the run shows the reason as a notice rather than a log line. */
  shouldAnnotate: boolean;

  /** Whether to build, since an entry publishes to npm. */
  shouldBuild: boolean;
};

/**
 * Decides whether the release run opens the version PR, publishes, or does
 * nothing.
 *
 * - A releasing changeset pending means the version PR comes first.
 *
 * - Otherwise it publishes what the publish plan lists, even while empty
 *   changesets are pending, which `changesets/action/publish` never reads;
 *   with nothing listed, it does nothing, so a docs-only merge builds
 *   nothing.
 *
 * - An entry at `0.0.0`, which no version PR has bumped yet, is held back
 *   with a notice naming it, as is each that depends on one, so a new package
 *   or action isn't published or tagged before its first version PR, while
 *   the rest still publish.
 *
 * @returns the decision.
 */
export function decideRelease({
  changesets,
  readPlan,
}: {
  /** The pending changesets. */
  changesets: readonly Changeset[];

  /**
   * Reads the publish plan, called only when no changeset releases anything,
   * since the plan asks the registry about every package.
   */
  readPlan: () => ReadPlan;
}): ReleaseDecision {
  if (changesets.some((changeset) => changeset.releases.length > 0)) {
    return {
      next: "version",
      planFile: "",
      reason:
        "A pending changeset releases a package, so the version PR comes " +
        "first.",
      shouldAnnotate: false,
      shouldBuild: false,
    };
  }

  const { entries, file, held } = readPlan();
  const heldReason = describeHeld(held);

  if (entries.length === 0) {
    return {
      next: "none",
      planFile: file,
      reason: heldReason ?? "Nothing is waiting to publish or tag.",
      shouldAnnotate: heldReason !== undefined,
      shouldBuild: false,
    };
  }

  const publishing = `Publishing or tagging ${entries
    .map((entry) => `${entry.name}@${entry.version}`)
    .join(", ")}.`;

  return {
    next: "publish",
    planFile: file,
    reason:
      heldReason === undefined ? publishing : `${publishing} ${heldReason}`,
    shouldAnnotate: true,
    shouldBuild: entries.some((entry) => entry.kind === "publish"),
  };
}

/**
 * Describes the entries held back, at `0.0.0` or depending on one.
 *
 * @param held - the held entries.
 * @returns the sentence, or `undefined` when none is held.
 */
function describeHeld(held: readonly PublishEntry[]): string | undefined {
  if (held.length === 0) {
    return undefined;
  }

  const isOne = held.length === 1;

  return (
    `Holding back ${held.map((entry) => entry.name).join(", ")}, at 0.0.0 ` +
    `or depending on a package that is, until a version PR bumps ` +
    `${isOne ? "it" : "them"}.`
  );
}
