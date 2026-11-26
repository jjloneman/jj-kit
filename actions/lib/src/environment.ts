import { tmpdir } from "node:os";

/** The environment an action's step passes in, one variable per input. */
export type Environment = Readonly<Record<string, string | undefined>>;

/**
 * The largest output a command may print: 64 MiB, or 67,108,864 bytes.
 *
 * - Node's own default is 1 MiB (1,048,576 bytes), which `git ls-tree` on a
 *   big repo outgrows.
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
