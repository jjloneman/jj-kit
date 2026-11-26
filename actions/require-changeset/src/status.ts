import type { ReleasePlan } from "../../lib/src/release-plan.ts";

/** The hint printed when a PR adds no changeset. */
export const NO_CHANGESET_ERROR: string =
  "This PR adds no changeset. Run `pnpm changeset`, or " +
  "`pnpm changeset --empty` if it releases nothing.";

/**
 * Judges a release plan against what the PR needs.
 *
 * - A PR that ships no package's dependency change needs any changeset, an
 *   empty one included.
 *
 * - A Renovate PR that changes what packages ship needs a changeset that
 *   releases each of them, since an empty one, one releasing another package,
 *   or one naming it with `none`, would merge the change without a release.
 *
 * @returns the error to report, or `undefined` when the PR passes.
 */
export function judgeReleasePlan({
  plan,
  shippedPackages,
}: {
  /** The PR's release plan. */
  plan: ReleasePlan;

  /** The versioned packages the PR ships a change to. */
  shippedPackages: readonly string[];
}): string | undefined {
  if (shippedPackages.length > 0) {
    const released = new Set(
      plan.releases
        .filter((release) => release.type !== "none")
        .map((release) => release.name)
    );
    const missing = shippedPackages.filter((name) => !released.has(name));

    return missing.length > 0 ? renovateError(missing) : undefined;
  }

  return plan.changesets.length === 0 ? NO_CHANGESET_ERROR : undefined;
}

/**
 * Says what to do when `changeset status` itself fails, without claiming why
 * it failed.
 *
 * @param shippedPackages - the packages a Renovate PR ships, if any.
 * @returns the hint.
 */
export function statusFailureHint(shippedPackages: readonly string[]): string {
  const hint =
    shippedPackages.length > 0
      ? renovateError(shippedPackages)
      : "If this PR adds no changeset, run `pnpm changeset`, or " +
        "`pnpm changeset --empty` if it releases nothing.";

  return `\`changeset status\` failed; see its output above. ${hint}`;
}

/**
 * Says which packages a Renovate PR's changeset must release.
 *
 * @param packages - the packages it ships but doesn't release.
 * @returns the error.
 */
function renovateError(packages: readonly string[]): string {
  return (
    `This Renovate PR changes what ${packages.join(", ")} ships. Add a ` +
    "`pnpm changeset` to its branch that bumps " +
    (packages.length === 1 ? "it." : "each of them.")
  );
}
