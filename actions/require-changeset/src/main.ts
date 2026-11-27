import { execFileSync } from "node:child_process";

import type { Environment } from "../../lib/src/environment.ts";
import type { RenovateChange } from "./ships.ts";

import { annotate, describeError } from "../../lib/src/annotate.ts";
import {
  checkChangesetsCli,
  runChangesetStatus,
} from "../../lib/src/changeset-status.ts";
import { MAX_BUFFER } from "../../lib/src/environment.ts";
import { classifyPullRequest, parseLines } from "./branches.ts";
import { git, packFiles, readRevisions, splitNul } from "./readers.ts";
import { analyzeRenovateChange } from "./ships.ts";
import { judgeReleasePlan, statusFailureHint } from "./status.ts";

/**
 * Runs the changeset check for one pull request.
 *
 * - Any unexpected error fails the check rather than passing it, so a broken
 *   check never skips a changeset.
 *
 * @param env - the step's environment, such as `process.env`.
 * @returns the process exit code: `0` when the PR passes, else `1`.
 */
export function main(env: Environment): number {
  try {
    return check(env);
  } catch (error: unknown) {
    annotate({
      level: "error",
      message: describeError(error),
    });

    return 1;
  }
}

/**
 * Runs the check, letting unexpected errors through to `main`.
 *
 * @param env - the step's environment.
 * @returns the process exit code.
 */
function check(env: Environment): number {
  const base = env.BASE ?? "";
  const headRef = env.HEAD_REF ?? "";

  if (base === "" || headRef === "") {
    annotate({
      level: "error",
      message:
        "require-changeset runs on pull_request events only, where the " +
        "base and head branches are known.",
    });

    return 1;
  }

  const kind = classifyPullRequest({
    author: env.PR_AUTHOR ?? "",
    base,
    headRef,
    headRepo: env.HEAD_REPO ?? "",
    renovateAuthors: parseLines(env.RENOVATE_AUTHORS ?? ""),
    renovateBranches: parseLines(env.RENOVATE_BRANCHES ?? ""),
    repo: env.REPOSITORY ?? "",
    skipBranches: parseLines(env.SKIP_BRANCHES ?? ""),
    versionPrAuthors: parseLines(env.VERSION_PR_AUTHORS ?? ""),
  });

  if (kind === "version-pr" || kind === "skip-branch") {
    annotate({
      level: "notice",
      message:
        kind === "version-pr"
          ? `Skipped: ${headRef} is the version PR, which only consumes ` +
            "changesets."
          : `Skipped: ${headRef} matches \`skip-branches\`.`,
    });

    return 0;
  }

  const baseRef = `origin/${base}`;
  const checkoutError = findCheckoutError(baseRef);

  if (checkoutError !== undefined) {
    annotate({ level: "error", message: checkoutError });

    return 1;
  }

  const change =
    kind === "renovate"
      ? renovateChange(baseRef)
      : { hasOtherChanges: true, shippedPackages: [] };

  if (!change.hasOtherChanges && change.shippedPackages.length === 0) {
    annotate({
      level: "notice",
      message:
        "Skipped: this Renovate PR changes no package's dependencies, " +
        "peer or optional dependencies, or engines, and no file a package " +
        "ships.",
    });

    return 0;
  }

  checkChangesetsCli();

  const plan = runChangesetStatus({ env, since: baseRef });

  if (plan === undefined) {
    annotate({
      level: "error",
      message: statusFailureHint(change.shippedPackages),
    });

    return 1;
  }

  const error = judgeReleasePlan({
    plan,
    shippedPackages: change.shippedPackages,
  });

  if (error !== undefined) {
    annotate({ level: "error", message: error });

    return 1;
  }

  console.log(
    change.shippedPackages.length > 0
      ? "This Renovate PR's changeset releases " +
          `${change.shippedPackages.join(", ")}.`
      : "This PR adds a changeset."
  );

  return 0;
}

/**
 * Checks that the checkout has the history `changeset status` diffs against.
 *
 * @param baseRef - the base branch's remote ref, such as `origin/main`.
 * @returns the error to report, or `undefined` when the checkout is usable.
 */
function findCheckoutError(baseRef: string): string | undefined {
  if (git(["rev-parse", "--is-shallow-repository"]).trim() === "true") {
    return (
      "The checkout is shallow. Check out with `fetch-depth: 0`, so the " +
      "base branch can be diffed against."
    );
  }

  try {
    git(["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`]);
  } catch {
    return `${baseRef} isn't fetched. Check out with \`fetch-depth: 0\`.`;
  }

  return undefined;
}

/**
 * Parses YAML through `yq`, which GitHub's Ubuntu runners ship.
 *
 * @param text - the YAML text.
 * @returns the parsed data.
 */
function parseYaml(text: string): unknown {
  const json = execFileSync("yq", ["-o", "json", ".", "-"], {
    encoding: "utf8",
    input: text,
    maxBuffer: MAX_BUFFER,
  }).trim();

  // An empty file, or one of comments only, prints nothing.
  return json === "" ? null : JSON.parse(json);
}

/**
 * Works out what a Renovate PR changes, comparing its head with its merge
 * base so a base branch that moved on doesn't count.
 *
 * - Renames are listed as a deletion and an addition, so a file moved out of a
 *   package needs a changeset there, as any deleted file does.
 *
 * - Both revisions' manifests are read through one `git cat-file --batch`.
 *
 * @param baseRef - the base branch's remote ref.
 * @returns the change's kind and the packages it ships.
 */
function renovateChange(baseRef: string): RenovateChange {
  const mergeBase = git(["merge-base", baseRef, "HEAD"]).trim();
  const changedFiles = splitNul(
    git(["diff", "--name-only", "--no-renames", "-z", mergeBase, "HEAD"])
  );

  return analyzeRenovateChange({
    ...readRevisions({ after: "HEAD", before: mergeBase }),
    changedFiles,
    packFiles,
    parseYaml,
  });
}
