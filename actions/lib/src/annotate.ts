/**
 * Prints a GitHub Actions annotation, escaping what the runner would read as
 * a line break.
 */
export function annotate({
  level,
  message,
}: {
  /** The annotation's level. */
  level: "error" | "notice" | "warning";

  /** The text to show. */
  message: string;
}): void {
  const escaped = message
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");

  console.log(`::${level}::${escaped}`);
}

/**
 * Describes a caught value, which may not be an `Error`.
 *
 * @param error - the caught value.
 * @returns its message, or the value as a string.
 */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
