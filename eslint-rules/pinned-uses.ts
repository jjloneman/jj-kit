/*
 * A jj-kit rule with no okf-tools original.
 *
 * - #10 carries it into `@jjloneman/kit-eslint-config`, or drops it there in
 *   favor of a workflow auditor.
 */
import type { Rule } from "eslint";

/** A container image pinned by its `sha256` digest. */
const DOCKER_PIN = /^docker:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/;

/** A path inside the repo, with no segment that starts with a dot. */
const LOCAL_PATH = /^\.\/[\w-][\w.-]*(?:\/[\w-][\w.-]*)*$/;

/** `<owner>/<repo>[/<path>]@<sha>`, pinned by a full 40-character SHA. */
const SHA_PIN = /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}$/;

/** The rest of the line after a SHA pin: its exact tag, which Renovate reads. */
const TAG_COMMENT = /^[ \t]+# v\d+\.\d+\.\d+$/;

/** The parts of a YAML scalar node this rule reads. */
type YamlScalar = {
  /** Where the scalar starts and ends, quotes included. */
  loc: {
    /** The position just past its last character. */
    end: { column: number; line: number };

    /** The position of its first character. */
    start: { column: number; line: number };
  };

  /** The node's kind. */
  type: "YAMLScalar";

  /** The scalar's parsed value. */
  value: unknown;
};

/**
 * Tells whether a YAML AST node is a scalar.
 *
 * @param node - the node to check, of any kind.
 * @returns whether it's a `YAMLScalar`.
 */
function isScalar(node: unknown): node is YamlScalar {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    node.type === "YAMLScalar"
  );
}

/**
 * Reports a `uses:` that an upstream could move: one that's neither a local
 * path, a digest-pinned image nor a full-SHA pin with its `# vX.Y.Z` tag on the
 * same line.
 *
 * - Not fixable: the SHA has to be looked up from the tag.
 */
export const PINNED_USES: Rule.RuleModule = {
  /**
   * Builds the rule's listeners for one linted file.
   *
   * @param context - the rule context for the file being linted.
   * @returns the listeners, keyed by the AST node they visit.
   */
  create(context) {
    return {
      /**
       * Checks one `key: value` pair, when its key is `uses`.
       *
       * @param pair - a YAML pair node, typed loosely since ESLint's types
       *   know only ESTree nodes.
       */
      YAMLPair(pair: unknown) {
        if (
          typeof pair !== "object" ||
          pair === null ||
          !("key" in pair) ||
          !("value" in pair)
        ) {
          return;
        }

        const { key, value } = pair;

        if (!isScalar(key) || key.value !== "uses" || !isScalar(value)) {
          return;
        }

        const uses = String(value.value);

        if (LOCAL_PATH.test(uses) || DOCKER_PIN.test(uses)) {
          return;
        }

        if (!SHA_PIN.test(uses)) {
          context.report({ data: { uses }, loc: value.loc, messageId: "sha" });

          return;
        }

        const { column, line } = value.loc.end;
        const rest = context.sourceCode.lines[line - 1]?.slice(column) ?? "";

        if (!TAG_COMMENT.test(rest)) {
          context.report({ data: { uses }, loc: value.loc, messageId: "tag" });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Require every `uses:` to be a local path or pinned by full SHA with " +
        "its tag in a comment.",
    },
    messages: {
      sha:
        "`{{ uses }}` isn't pinned by full commit SHA. Write " +
        "`uses: <action>@<sha> # vX.Y.Z`, the SHA its tag points to.",
      tag:
        "`{{ uses }}` needs its exact tag in a comment on the same line, " +
        "`# vX.Y.Z`, for Renovate to update it.",
    },
    schema: [],
    type: "problem",
  },
};
