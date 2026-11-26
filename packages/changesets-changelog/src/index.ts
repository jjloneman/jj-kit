/*
 * A changesets changelog formatter that reuses each commit's gitmoji and
 * scope, named by `changelog` in a repo's `.changeset/config.json`.
 *
 * - Each line takes the gitmoji and scope from the subject of the commit that
 *   added the changeset, which after a squash merge is the PR title:
 *   `- ✨ **scope:** <summary> (<short hash>)`.
 *
 * - jj-kit loads this file itself under Node's type stripping, so it uses
 *   only erasable syntax and `.ts` import specifiers; consumers load the
 *   built `dist/`, since Node won't strip types under `node_modules`.
 */
import { execFileSync } from "node:child_process";

/**
 * The two functions changesets calls.
 *
 * - Narrower than changesets' own `ChangelogFunctions`: each returns a plain
 *   string and leaves out the parameters it doesn't use, which changesets'
 *   type still accepts.
 */
export type ChangelogFunctions = {
  /** Build the lines for a release that only bumps its dependencies. */
  getDependencyReleaseLine: typeof getDependencyReleaseLine;

  /** Build one changeset's line. */
  getReleaseLine: typeof getReleaseLine;
};

/** A changeset as changesets passes it to the formatter. */
export type ChangesetWithCommit = {
  /**
   * The hash of the commit that added the changeset, when git found one.
   *
   * @example "b4fc42d0d5a0e1f2c3b4a5968778695a4b3c2d1e"
   */
  commit?: string;

  /**
   * The changeset's markdown body, which may span several lines.
   *
   * @example "Add `getDependencyReleaseLine`, which lists bumped packages."
   */
  summary: string;
};

/** What reading a commit's subject found. */
export type CommitLookup =
  | {
      /**
       * git has no such commit, such as a hash from before a squash, or git
       * failed for another reason, so the subject is unknown.
       *
       * @example "missing"
       */
      status: "missing" | "unreadable";
    }
  | {
      /** git read the commit. @example "found" */
      status: "found";

      /**
       * The commit's subject line.
       *
       * @example "feat(eslint-config): ✨ add the react preset (#12)"
       */
      subject: string;
    };

/** The parts of a `<type>(<scope>)!: <gitmoji> <subject>` commit subject. */
export type ConventionalSubject = {
  /** The gitmoji after the colon, when there is one. @example "✨" */
  gitmoji?: string;

  /** Whether the type carries the breaking-change `!`. @example true */
  isBreaking: boolean;

  /** The scope in parentheses, when there is one. @example "eslint-config" */
  scope?: string;
};

/** A dependency bumped in the same release, as changesets passes it. */
export type DependencyUpdate = {
  /**
   * The dependency's package name.
   *
   * @example `"@jjloneman/kit-eslint-plugin"`
   */
  name: string;

  /**
   * The version it was bumped to; absent for a `none` release, which
   * changesets can pass though nothing was bumped.
   *
   * @example "1.2.0"
   */
  newVersion?: string | undefined;
};

/**
 * One pictograph, with an optional skin tone and variation selector.
 *
 * - Escapes rather than the literal characters, since the variation selector
 *   is invisible in an editor.
 */
const PICTOGRAPH_SOURCE =
  String.raw`\p{Extended_Pictographic}` +
  String.raw`\p{Emoji_Modifier}?\u{FE0F}?`;

/**
 * One gitmoji: a pictograph, optionally joined to more of the same.
 *
 * - `🏗️` and `⬆️` match whole, and a plain first word never does.
 *
 * - An escape rather than the literal joiner, which is invisible in an
 *   editor.
 */
const GITMOJI_SOURCE =
  PICTOGRAPH_SOURCE + String.raw`(?:\u{200D}${PICTOGRAPH_SOURCE})*`;

/**
 * The exit status `git rev-parse --verify --quiet` gives a revision that
 * names no commit, as opposed to 128 for git failing outright.
 */
const NO_SUCH_COMMIT_STATUS = 1;

/**
 * How long one git call may run before it's abandoned.
 *
 * - Lazy fetches and prompts are off, so only a stuck process reaches it;
 *   the line then keeps its hash, as for any other failure.
 */
const GIT_TIMEOUT_MS = 10_000;

/** Characters Markdown would read as formatting inside a bold scope. */
const MARKDOWN_SPECIAL_PATTERN = /[!#*<>[\\\]_`|~]/gu;

/**
 * Lookups already made, keyed by repo and hash.
 *
 * - changesets asks for one line at a time, so the calls can't be batched;
 *   a commit that added several changesets is still read only once.
 */
const LOOKUP_CACHE = new Map<string, CommitLookup>();

/** The length a hash is shortened to in a line, as changesets' own does. */
const SHORT_HASH_LENGTH = 7;

/**
 * A conventional-commit subject: the type, an optional scope and `!`, then
 * an optional gitmoji before the description.
 */
const SUBJECT_PATTERN = new RegExp(
  String.raw`^\w+(?:\((?<scope>[^()]+)\))?(?<breaking>!)?: ` +
    String.raw`(?:(?<gitmoji>${GITMOJI_SOURCE})\s+)?\S`,
  "u"
);

/**
 * Build one changelog line from a changeset and what reading its commit
 * found.
 *
 * - A commit git has no record of, such as a hash from before a squash, gives
 *   the bare summary, without a hash to a commit that isn't on `main`.
 *
 * - A commit git couldn't read for another reason keeps its hash, with no
 *   gitmoji or scope, since the hash came from the repo's own history.
 *
 * - A summary's later lines are indented under the bullet, as changesets'
 *   default formatter does.
 *
 * @returns the markdown list item.
 */
export function formatReleaseLine({
  changeset,
  lookup,
}: {
  /** The changeset the line describes. */
  changeset: ChangesetWithCommit;

  /**
   * What reading the commit that added it found, or `undefined` when it has
   * no commit.
   */
  lookup: CommitLookup | undefined;
}): string {
  const [firstLine, ...laterLines] = changeset.summary
    .trim()
    .split("\n")
    .map((line) => line.trimEnd());

  const { gitmoji, isBreaking, scope }: Partial<ConventionalSubject> =
    lookup?.status === "found" ? parseConventionalSubject(lookup.subject) : {};

  const parts = [
    gitmoji,
    scope === undefined ? undefined : `**${escapeMarkdown(scope)}:**`,
    isBreaking === true ? "**Breaking:**" : undefined,
    firstLine,
    changeset.commit === undefined || lookup?.status === "missing"
      ? undefined
      : `(${shortenHash(changeset.commit)})`,
  ].filter((part) => part !== undefined && part !== "");

  return [
    `- ${parts.join(" ")}`,
    ...laterLines.map((line) => (line === "" ? line : `  ${line}`)),
  ].join("\n");
}

/**
 * The changesets entry point for a release's dependency bumps.
 *
 * - Positional parameters, since changesets calls it as
 *   `(changesets, dependenciesUpdated, options)`; the unused `options` is
 *   left out.
 *
 * - One `Updated dependencies` line with each changeset's short hash, then
 *   one sub-item per bumped dependency, the shape changesets' default
 *   formatter uses, without repeating the line per changeset.
 *
 * - A dependency with no new version, a `none` release, is left out rather
 *   than printed as `name@undefined`.
 *
 * @param changesets - The changesets in the release, each with the hash of
 *   the commit that added it.
 * @param dependenciesUpdated - The dependencies bumped in the same release,
 *   including any `none` release with no new version.
 * @returns the lines, or an empty string, which changesets leaves out, when
 *   no dependency was bumped.
 */
export function getDependencyReleaseLine(
  changesets: readonly ChangesetWithCommit[],
  dependenciesUpdated: readonly DependencyUpdate[]
): string {
  const bumped = dependenciesUpdated.flatMap(({ name, newVersion }) =>
    newVersion === undefined ? [] : [`  - ${name}@${newVersion}`]
  );

  if (bumped.length === 0) {
    return "";
  }

  const hashes = [
    ...new Set(
      changesets.flatMap(({ commit }) =>
        commit === undefined ? [] : [shortenHash(commit)]
      )
    ),
  ];

  return [
    hashes.length === 0
      ? "- Updated dependencies"
      : `- Updated dependencies [${hashes.join(", ")}]`,
    ...bumped,
  ].join("\n");
}

/**
 * The changesets entry point for one changeset's line.
 *
 * - Reads git from the process's directory, since changesets passes the
 *   formatter no directory and runs from the repo root; once installed, this
 *   file lives in `node_modules`, not the repo.
 *
 * - changesets also passes the bump type and options, which the line doesn't
 *   use, so they're left out.
 *
 * @returns the markdown list item.
 */
export function getReleaseLine(changeset: ChangesetWithCommit): string {
  if (changeset.commit === undefined) {
    return formatReleaseLine({ changeset, lookup: undefined });
  }

  /*
   * The process's directory, not the `cwd` changesets found the commits
   * from, which it doesn't pass on.
   *
   * - The two match whenever changesets runs from its CLI or its GitHub
   *   Action, both of which run from the repo root.
   *
   * - They can differ only through changesets' programmatic API called from
   *   another directory; each commit then reads as missing, and its line
   *   falls back to the bare summary.
   */
  const cwd = process.cwd();

  return formatReleaseLine({
    changeset,
    lookup: readCommitSubject({ cwd, hash: changeset.commit }),
  });
}

/**
 * Read the gitmoji, scope, and breaking-change marker from a
 * conventional-commit subject.
 *
 * @returns the parts found; none are set when the subject doesn't parse.
 */
export function parseConventionalSubject(subject: string): ConventionalSubject {
  const groups = SUBJECT_PATTERN.exec(subject)?.groups;

  return {
    ...(groups?.gitmoji === undefined ? {} : { gitmoji: groups.gitmoji }),
    isBreaking: groups?.breaking !== undefined,
    ...(groups?.scope === undefined ? {} : { scope: groups.scope }),
  };
}

/**
 * Read a commit's subject line, once per repo and hash.
 *
 * @returns the subject, or whether git had no such commit or couldn't read
 *   it.
 */
export function readCommitSubject({
  cwd,
  hash,
}: {
  /** The repo to read from. @example "/Users/me/jj-kit" */
  cwd: string;

  /**
   * The commit to read; never read as an option, even when it starts with
   * `-`.
   *
   * @example "b4fc42d"
   */
  hash: string;
}): CommitLookup {
  const key = `${cwd}\0${hash}`;
  const cached = LOOKUP_CACHE.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const lookup = readUncachedSubject({ cwd, hash });
  LOOKUP_CACHE.set(key, lookup);

  return lookup;
}

/**
 * Say why a call failed, from whatever it threw.
 *
 * @returns the error's message, or the thrown value as a string.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Escape the characters Markdown would read as formatting.
 *
 * @returns the text with each one backslash-escaped.
 */
function escapeMarkdown(text: string): string {
  return text.replaceAll(MARKDOWN_SPECIAL_PATTERN, String.raw`\$&`);
}

/**
 * Whether git exited with the status meaning "no such commit".
 *
 * @returns `true` for that status alone.
 */
function isNoSuchCommit(error: unknown): boolean {
  return (
    error instanceof Error &&
    "status" in error &&
    error.status === NO_SUCH_COMMIT_STATUS
  );
}

/**
 * Ask git for a commit's subject line.
 *
 * - `rev-parse` first, whose exit status tells a missing commit apart from
 *   git failing, in any locale and without reading its messages.
 *
 * @returns the subject, or whether git had no such commit or couldn't read
 *   it.
 */
function readUncachedSubject({
  cwd,
  hash,
}: {
  /** The repo to read from. */
  cwd: string;

  /** The commit to read. */
  hash: string;
}): CommitLookup {
  let fullHash: string;

  try {
    fullHash = runGit({
      args: [
        "rev-parse",
        "--verify",
        "--quiet",
        "--end-of-options",
        `${hash}^{commit}`,
      ],
      cwd,
    }).trim();
  } catch (error: unknown) {
    // A hash from before a squash is expected; anything else is worth a look.
    return isNoSuchCommit(error)
      ? { status: "missing" }
      : reportUnreadable({ error, hash });
  }

  try {
    // `--no-show-signature`, or `log.showSignature` would print gpg's check
    // ahead of the subject.
    const subject = runGit({
      args: ["log", "-1", "--format=%s", "--no-show-signature", fullHash, "--"],
      cwd,
    }).trim();

    return { status: "found", subject };
  } catch (error: unknown) {
    return reportUnreadable({ error, hash });
  }
}

/**
 * Warn that a commit couldn't be read.
 *
 * @returns the `unreadable` lookup.
 */
function reportUnreadable({
  error,
  hash,
}: {
  /** What git threw; its message carries git's stderr. */
  error: unknown;

  /** The commit that couldn't be read. */
  hash: string;
}): CommitLookup {
  console.warn(
    `[kit-changesets-changelog] couldn't read commit ${hash}, so its ` +
      `line has no gitmoji or scope: ${describeError(error).trim()}`
  );

  return { status: "unreadable" };
}

/**
 * Run git in a directory, with stdin ignored and its output captured.
 *
 * - Lazy fetches and credential prompts are off, so a partial clone missing
 *   a commit fails at once rather than waiting on the network or a prompt.
 *
 * @returns what git printed to stdout.
 */
function runGit({
  args,
  cwd,
}: {
  /**
   * The arguments after `git`.
   *
   * @example `["log", "-1", "--format=%s", "HEAD"]`
   */
  args: readonly string[];

  /** The directory to run it in. */
  cwd: string;
}): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: GIT_TIMEOUT_MS,
  });
}

/**
 * Shorten a commit hash for a changelog line.
 *
 * @returns its first seven characters.
 */
function shortenHash(hash: string): string {
  return hash.slice(0, SHORT_HASH_LENGTH);
}

/** The formatter, in the shape changesets loads from `changelog`. */
const CHANGELOG_FUNCTIONS: ChangelogFunctions = {
  getDependencyReleaseLine,
  getReleaseLine,
};

export default CHANGELOG_FUNCTIONS;
