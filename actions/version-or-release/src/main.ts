import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";

import type { Environment } from "../../lib/src/environment.ts";
import type { SetAsideDecision } from "./set-aside.ts";

import { annotate, describeError } from "../../lib/src/annotate.ts";
import {
  CHANGESET_CONFIG,
  readChangesetConfig,
} from "../../lib/src/changeset-config.ts";
import {
  checkChangesetsCli,
  runChangesetStatus,
} from "../../lib/src/changeset-status.ts";
import { MAX_BUFFER } from "../../lib/src/environment.ts";
import { decideSetAside, parseWorkspacePackages } from "./set-aside.ts";

/**
 * Sets aside the pending changesets when every one is empty, so the release
 * run publishes rather than doing nothing.
 *
 * - When it can't read the changesets, the config or the workspace's
 *   packages, it warns and leaves the changesets alone, so `changesets/action`
 *   still runs as it would without this step.
 *
 * - Only `@changesets/cli` older than 3, or a failure while deleting a
 *   changeset, fails the step; a half-deleted set would publish or version
 *   from a state no one chose.
 *
 * @param env - the step's environment, such as `process.env`.
 * @returns the process exit code.
 */
export function main(env: Environment): number {
  try {
    checkChangesetsCli();
  } catch (error: unknown) {
    annotate({ level: "error", message: describeError(error) });

    return 1;
  }

  const decision = readDecision(env);

  if (decision === undefined) {
    return 0;
  }

  try {
    for (const id of decision.ids) {
      rmSync(path.join(".changeset", `${id}.md`));
    }
  } catch (error: unknown) {
    annotate({ level: "error", message: describeError(error) });

    return 1;
  }

  if (decision.shouldAnnotate) {
    annotate({ level: "notice", message: decision.reason });
  } else {
    console.log(decision.reason);
  }

  return 0;
}

/**
 * Reads the pending changesets, the config and the workspace's packages, and
 * decides.
 *
 * @param env - the step's environment.
 * @returns the decision, or `undefined` when anything can't be read.
 */
function readDecision(env: Environment): SetAsideDecision | undefined {
  try {
    const plan = runChangesetStatus({ env });

    if (plan === undefined) {
      throw new Error("changeset status failed; see its output above.");
    }

    const packages = execFileSync(
      "pnpm",
      ["-r", "ls", "--depth", "-1", "--json"],
      { encoding: "utf8", maxBuffer: MAX_BUFFER }
    );

    return decideSetAside({
      changesets: plan.changesets,
      config: readChangesetConfig(
        existsSync(CHANGESET_CONFIG)
          ? readFileSync(CHANGESET_CONFIG, "utf8")
          : undefined
      ),
      packages: parseWorkspacePackages({
        rootDir: realpathSync(process.cwd()),
        text: packages,
      }),
    });
  } catch (error: unknown) {
    annotate({
      level: "warning",
      message:
        "Couldn't read the pending changesets, so they're left as they are: " +
        describeError(error),
    });

    return undefined;
  }
}
