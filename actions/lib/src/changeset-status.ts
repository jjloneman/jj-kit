import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import type { Environment } from "./environment.ts";
import type { ReleasePlan } from "./release-plan.ts";

import { tempFolder } from "./environment.ts";
import { parseReleasePlan } from "./release-plan.ts";

/**
 * The oldest `@changesets/cli` major whose config defaults the actions read.
 */
const MINIMUM_MAJOR = 3;

/**
 * Checks that `@changesets/cli` is version 3 or later, whose `privatePackages`
 * defaults the actions assume.
 *
 * - It reads the version from the last line `changeset --version` prints, so
 *   a notice printed before it doesn't matter.
 *
 * @throws when the version is older or can't be read.
 */
export function checkChangesetsCli(): void {
  const output = execFileSync("pnpm", ["exec", "changeset", "--version"], {
    encoding: "utf8",
  });
  const lastLine = output
    .trim()
    .replace(/^[\s\S]*\n/u, "")
    .trim();
  const major = /^v?(?<major>\d+)\.\d+\.\d+/u.exec(lastLine)?.groups?.major;

  if (major === undefined || Number(major) < MINIMUM_MAJOR) {
    throw new Error(
      `The kit's actions need @changesets/cli ${String(MINIMUM_MAJOR)} or ` +
        `later, but found ${lastLine === "" ? "none" : lastLine}.`
    );
  }
}

/**
 * Runs `changeset status --output` and reads the release plan it writes.
 *
 * - Its own output goes to the log, so a failure explains itself there.
 *
 * - A plan of the wrong shape throws, unlike a failed command.
 *
 * - The temp folder is removed once the plan is read.
 *
 * @returns the plan, or `undefined` when the command itself failed.
 */
export function runChangesetStatus({
  env,
  since,
}: {
  /** The step's environment, for the temp folder. */
  env: Environment;

  /** The ref to diff against, such as `origin/main`, or none for all. */
  since?: string;
}): ReleasePlan | undefined {
  const folder = mkdtempSync(path.join(tempFolder(env), "changeset-status-"));
  const output = path.join(folder, "status.json");

  try {
    try {
      execFileSync(
        "pnpm",
        [
          "exec",
          "changeset",
          "status",
          ...(since === undefined ? [] : [`--since=${since}`]),
          `--output=${output}`,
        ],
        { stdio: "inherit" }
      );
    } catch {
      return undefined;
    }

    return parseReleasePlan(readFileSync(output, "utf8"));
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
}
