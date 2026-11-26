import { tmpdir } from "node:os";

/** The environment an action's step passes in, one variable per input. */
export type Environment = Readonly<Record<string, string | undefined>>;

/**
 * The largest output a command may print, in bytes; `git ls-tree` on a big
 * repo outgrows Node's 1 MiB default.
 */
export const MAX_BUFFER: number = 64 * 1024 * 1024;

/**
 * Picks the folder for temporary files: the runner's, or the OS's when the
 * runner gives none, or an empty one.
 *
 * @param env - the step's environment.
 * @returns the folder.
 */
export function tempFolder(env: Environment): string {
  return env.RUNNER_TEMP === undefined || env.RUNNER_TEMP === ""
    ? tmpdir()
    : env.RUNNER_TEMP;
}
