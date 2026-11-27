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

/** What a changeset command wrote through `--output`. */
export type ChangesetOutput = {
  /** The file's path, inside `folder`. */
  file: string;

  /** The file's own temp folder. */
  folder: string;

  /** The file's text. */
  text: string;
};

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
 * Runs `changeset <args> --output=<file>` in a temp folder of its own, and
 * hands the file it writes to `read`.
 *
 * - Its own output goes to the log, so a failure explains itself there.
 *
 * - The folder is removed once `read` returns, unless `shouldKeep` asks to
 *   keep it, and always when anything fails, so no caller cleans up.
 *
 * - A command that couldn't start, such as with pnpm missing from `PATH`,
 *   throws its own error, since there's no output above to explain it.
 *
 * @returns what `read` returns, or `undefined` when the command ran and
 *   failed, or was killed.
 */
export function runChangesetJson<Result>({
  args,
  env,
  fileName,
  prefix,
  read,
  shouldKeep = false,
}: {
  /** The command's arguments before `--output`, such as `["status"]`. */
  args: readonly string[];

  /** The step's environment, for the temp folder. */
  env: Environment;

  /** The file's name, such as `status.json`. */
  fileName: string;

  /** The temp folder's name prefix, such as `changeset-status-`. */
  prefix: string;

  /** Reads what the command wrote; a throw removes the folder, then passes. */
  read: (output: ChangesetOutput) => Result;

  /** Whether the folder stays once `read` returns, for files written in it. */
  shouldKeep?: boolean;
}): Result | undefined {
  const folder = mkdtempSync(path.join(tempFolder(env), prefix));
  const file = path.join(folder, fileName);

  let isKept = false;

  try {
    try {
      execFileSync("pnpm", ["exec", "changeset", ...args, `--output=${file}`], {
        stdio: "inherit",
      });
    } catch (error: unknown) {
      if (hasRun(error)) {
        return undefined;
      }

      throw error;
    }

    const result = read({ file, folder, text: readFileSync(file, "utf8") });

    isKept = shouldKeep;

    return result;
  } finally {
    if (!isKept) {
      rmSync(folder, { force: true, recursive: true });
    }
  }
}

/**
 * Runs `changeset status --output` and reads the release plan it writes.
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
  return runChangesetJson({
    args: ["status", ...(since === undefined ? [] : [`--since=${since}`])],
    env,
    fileName: "status.json",
    prefix: "changeset-status-",
    read: ({ text }) => parseReleasePlan(text),
  });
}

/**
 * Decides whether a failed command ran: it has an exit status, or the signal
 * that killed it, where one that couldn't start, such as with pnpm missing
 * from `PATH`, has neither.
 *
 * - A caller then gets the spawn error itself, not its usual "see the output
 *   above" hint, since there's no output above to see.
 *
 * @param error - what `execFileSync` threw.
 * @returns whether the command ran.
 */
function hasRun(error: unknown): boolean {
  return (
    error instanceof Error &&
    (("status" in error && typeof error.status === "number") ||
      ("signal" in error && typeof error.signal === "string"))
  );
}
