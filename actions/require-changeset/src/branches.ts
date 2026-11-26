import path from "node:path";

/**
 * What the check does with a pull request:
 *
 * - `check`: it needs a changeset;
 * - `renovate`: a Renovate PR, which needs one only when it ships a change;
 * - `skip-branch`: its branch matches a `skip-branches` pattern;
 * - `version-pr`: the rolling version PR, which only consumes changesets.
 */
export type PullRequestKind =
  "check" | "renovate" | "skip-branch" | "version-pr";

/**
 * Decides how the check treats a pull request.
 *
 * - Only a PR from the base repo can skip or take the Renovate path, so a
 *   fork's branch of the same name is still checked.
 *
 * - The version PR and a Renovate PR are each matched by branch and author,
 *   so a person's branch of the same name is still checked.
 *
 * - In a branch glob, `*` stops at a `/` and `**` crosses it.
 *
 * @returns the pull request's kind, such as `version-pr`.
 */
export function classifyPullRequest({
  author,
  base,
  headRef,
  headRepo,
  renovateAuthors,
  renovateBranches,
  repo,
  skipBranches,
  versionPrAuthors,
}: {
  /** The login of the PR's author, such as `renovate[bot]`. */
  author: string;

  /** The branch the PR merges into, such as `main`. */
  base: string;

  /** The PR's head branch, such as `renovate/vitest-5.x`. */
  headRef: string;

  /** The head repo's `owner/name`. */
  headRepo: string;

  /** The logins whose Renovate-branch PRs take the Renovate path. */
  renovateAuthors: readonly string[];

  /** Globs of the branches Renovate opens PRs from, such as `renovate/**`. */
  renovateBranches: readonly string[];

  /** The base repo's `owner/name`. */
  repo: string;

  /** Extra glob patterns for head branches that skip the check. */
  skipBranches: readonly string[];

  /** The logins whose `changeset-release/<base>` PR is the version PR. */
  versionPrAuthors: readonly string[];
}): PullRequestKind {
  if (headRepo !== repo) {
    return "check";
  }

  if (
    headRef === `changeset-release/${base}` &&
    versionPrAuthors.includes(author)
  ) {
    return "version-pr";
  }

  if (
    skipBranches.some((pattern) => path.posix.matchesGlob(headRef, pattern))
  ) {
    return "skip-branch";
  }

  if (
    renovateBranches.some((pattern) =>
      path.posix.matchesGlob(headRef, pattern)
    ) &&
    renovateAuthors.includes(author)
  ) {
    return "renovate";
  }

  return "check";
}

/**
 * Splits a multi-line action input into its entries.
 *
 * @param text - the input's text.
 * @returns each non-blank line, trimmed.
 */
export function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
