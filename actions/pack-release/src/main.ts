import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { Environment } from "../../lib/src/environment.ts";
import type { ReadPlan, ReleaseDecision } from "./decide.ts";

import { annotate, describeError } from "../../lib/src/annotate.ts";
import {
  checkChangesetsCli,
  runChangesetStatus,
} from "../../lib/src/changeset-status.ts";
import { MAX_BUFFER, tempFolder } from "../../lib/src/environment.ts";
import { decideRelease } from "./decide.ts";
import { splitPublishPlan } from "./publish-plan.ts";
import { readDependencies } from "./workspace.ts";

/**
 * The kept plan's file name, which `changesets/action/pack` looks for in the
 * artifact it downloads.
 */
const PLAN_FILE = "publish-plan.json";

/** The file `changeset publish-plan` writes, before any entry is held. */
const RAW_PLAN_FILE = "raw-publish-plan.json";

/**
 * Decides what the release run does next, and writes it to the step's
 * outputs for the action's later steps and the job that publishes.
 *
 * - It fails, rather than guess, when it can't read the pending changesets or
 *   the publish plan: a wrong `none` would skip a release without a word.
 *
 * - `@changesets/cli` older than 3 fails it too, since the plan's rules
 *   depend on v3's `privatePackages` defaults.
 *
 * @param env - the step's environment, such as `process.env`.
 * @returns the process exit code.
 */
export function main(env: Environment): number {
  try {
    checkChangesetsCli();

    const outputFile = env.GITHUB_OUTPUT;

    if (outputFile === undefined || outputFile === "") {
      throw new Error("GITHUB_OUTPUT isn't set, so there's nowhere to write.");
    }

    const status = runChangesetStatus({ env });

    if (status === undefined) {
      throw new Error("changeset status failed; see its output above.");
    }

    const decision = decideRelease({
      changesets: status.changesets,
      readPlan: () => readPublishPlan(env),
    });

    report(decision);

    // Only a publish keeps the plan, for the pack step to upload.
    if (decision.next === "none") {
      rmSync(path.dirname(decision.planFile), {
        force: true,
        recursive: true,
      });
    }

    appendFileSync(
      outputFile,
      [
        `next=${decision.next}`,
        `plan-file=${decision.next === "publish" ? decision.planFile : ""}`,
        `should-build=${String(decision.shouldBuild)}`,
        "",
      ].join("\n")
    );

    return 0;
  } catch (error: unknown) {
    annotate({ level: "error", message: describeError(error) });

    return 1;
  }
}

/**
 * Runs `changeset publish-plan --output` into a temp folder of its own, reads
 * the plan it writes, holding back its `0.0.0` entries and their dependents,
 * and writes the kept plan beside it.
 *
 * - Its own output goes to the log, so a failure explains itself there.
 *
 * - The raw file is removed once read, and the whole folder when anything
 *   fails.
 *
 * @param env - the step's environment, for the temp folder.
 * @returns the plan, and the kept plan's file.
 */
function readPublishPlan(env: Environment): ReadPlan {
  const folder = mkdtempSync(
    path.join(tempFolder(env), "changesets-publish-plan-")
  );
  const rawFile = path.join(folder, RAW_PLAN_FILE);
  const file = path.join(folder, PLAN_FILE);

  try {
    execFileSync(
      "pnpm",
      ["exec", "changeset", "publish-plan", `--output=${rawFile}`],
      { stdio: "inherit" }
    );

    const plan = splitPublishPlan({
      dependenciesOf: () =>
        readDependencies({
          listing: execFileSync(
            "pnpm",
            ["-r", "ls", "--depth", "-1", "--json"],
            { encoding: "utf8", maxBuffer: MAX_BUFFER }
          ),
          readManifest: (packageFolder) =>
            readFileSync(path.join(packageFolder, "package.json"), "utf8"),
        }),
      text: readFileSync(rawFile, "utf8"),
    });

    rmSync(rawFile, { force: true });
    writeFileSync(file, plan.text);

    return { entries: plan.entries, file, held: plan.held };
  } catch (error: unknown) {
    rmSync(folder, { force: true, recursive: true });

    throw error;
  }
}

/**
 * Prints why, as a notice when the decision asks for one.
 *
 * @param decision - the decision.
 */
function report(decision: ReleaseDecision): void {
  if (decision.shouldAnnotate) {
    annotate({ level: "notice", message: decision.reason });
  } else {
    console.log(decision.reason);
  }
}
