import type { Rule } from "eslint";

/*
 * `getAllComments` hands back the comment's *value* — its delimiters stripped —
 * so a match on the first line sits two characters right of where the comment
 * itself starts.
 */
const BLOCK_DELIMITER_WIDTH = "/*".length;

/*
 * A line that closes a fenced code block, such as an `@example`'s, as TSDoc
 * reads it: ```` ``` ```` right after the line's `* `, with no indent.
 *
 * - TSDoc closes a fence on such a line even with text after it, though it
 *   warns, so this matches the same lines.
 *
 * - TSDoc has no `~~~` fences, no longer backtick fences and no indented code
 *   blocks, so none of those hide a line from the rule either.
 */
const FENCE_CLOSE = /^(?:\s*\* ?)?```/;

/*
 * A line that opens a fenced code block: a closing fence whose info string,
 * such as `ts`, holds no backtick, since TSDoc reads ```` ```run()``` ```` as
 * an inline code span instead.
 */
const FENCE_OPEN = /^(?:\s*\* ?)?```[^`]*$/;

/*
 * The tags that name a param: TSDoc's `@param`, and JSDoc's `@arg` and
 * `@argument` aliases, which a comment carried over from JavaScript may use.
 */
const PARAM_TAG = /@(?:arg|param)/;

/*
 * Every line break ESLint counts when it numbers lines, so a report's line
 * matches the one an editor shows.
 */
const LINE_BREAK = /\r\n|[\n\r\u2028\u2029]/;

/*
 * Matches each TSDoc `@param` on a line that names a key of an object param.
 *
 * - The dot is the whole rule. A non-dotted `@param value - …` documents a
 *   positional param and is correct, so matching `@param` broadly would flag
 *   every one of those instead.
 *
 * - The tag may sit anywhere on the line after its start, a space or a `*`,
 *   since TSDoc reads a mid-line `@param`, such as one after the summary of
 *   a single-line doc block, as a block tag too; an indented `@param` counts
 *   as well, since TSDoc has no indented code blocks.
 *
 * - That covers a doc block written without a `*` per line, which Prettier
 *   leaves alone, so the style isn't left unscanned.
 *
 * - The lookbehind keeps out a `@param` glued to a word, as TSDoc does, and
 *   one right after a backtick, inside an inline code span.
 *
 * - A JSDoc-style `{type}` and an optional-param `[`, with or without spaces
 *   inside it, may sit between the tag and the name, so a comment carried
 *   over from plain JavaScript is caught too; the type may hold up to two
 *   levels of nested braces, as an object type such as
 *   `{{ retry: { limit: number } }}` does, on one line.
 *
 * - JSDoc's `employees[].name`, a key of each element of an array param, is
 *   just as invisible, so a `[]` may sit between the name and the dot.
 *
 * - `objectName` is the object's own name (`options`, `params`), so the
 *   message can quote the site as written, and `tag` is the tag as written,
 *   so the message quotes `@arg` for an `@arg`.
 *
 * - Names follow JavaScript's identifier rules, Unicode included, through the
 *   `u` flag's `ID_Start` and `ID_Continue` classes.
 */
const DOTTED_PARAM =
  /(?<=^|[\s*])@(?<tag>argument|arg|param)\s+(?:\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}\s*)?(?:\[\s*)?(?<objectName>[\p{ID_Start}$_][\p{ID_Continue}$]*)(?:\[\])?\.[\p{ID_Continue}$.]+/gu;

/**
 * Finds the lines of a doc comment's fenced code blocks, as TSDoc pairs their
 * fences, since a line there shows code rather than documenting it.
 *
 * - A fence that never closes holds nothing: TSDoc reports the missing fence
 *   and reads the lines after it as documentation, so the rule does too.
 *
 * @param lines - the comment's lines, in order.
 * @returns the indexes of every line from each opening fence to its closing
 *   one.
 */
function findCodeLines(lines: readonly string[]): Set<number> {
  const codeLines = new Set<number>();
  let openIndex: number | undefined;

  for (const [index, line] of lines.entries()) {
    if (openIndex === undefined) {
      if (FENCE_OPEN.test(line)) {
        openIndex = index;
      }
    } else if (FENCE_CLOSE.test(line)) {
      for (let codeIndex = openIndex; codeIndex <= index; codeIndex++) {
        codeLines.add(codeIndex);
      }

      openIndex = undefined;
    }
  }

  return codeLines;
}

/**
 * Reports a TSDoc `@param` whose name is dotted, e.g.
 * `@param options.fallback`.
 *
 * - `no-restricted-syntax` cannot express this: its selectors match AST nodes,
 *   and a doc block is a comment attached to the source text rather than a
 *   node the selector language can reach.
 *
 * - A pure comment scan, so it needs no type information, and it covers
 *   untyped `.js` and `.mjs` files as well as TypeScript.
 *
 * - Deliberately not fixable. Relocating the text means finding the matching
 *   property in the type literal, deleting rather than moving it when the param
 *   type is imported, and re-wrapping prose to the print width — three
 *   judgment calls a fixer would get wrong silently.
 */
export const NO_DOTTED_JSDOC_PARAM: Rule.RuleModule = {
  /**
   * Builds the rule's listeners for one linted file.
   *
   * @param context - the rule context for the file being linted.
   * @returns the listeners, keyed by the AST node they visit.
   */
  create(context) {
    const { sourceCode } = context;

    return {
      /**
       * Reports every dotted `@param` in the file's doc blocks.
       *
       * - `Program` runs once per linted file, and `sourceCode` is that file
       *   alone, so this scans one file's comments, never the whole project.
       */
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          // A cheap check first, since most doc blocks hold no `@param`.
          if (
            comment.type !== "Block" ||
            !comment.value.startsWith("*") ||
            !PARAM_TAG.test(comment.value)
          ) {
            continue;
          }

          // `getLoc` is typed non-optional, unlike the estree `loc`, so no
          // guard is needed for a location ESLint always records.
          const commentStart = sourceCode.getLoc(comment).start;

          const lines = comment.value.split(LINE_BREAK);
          const codeLines = findCodeLines(lines);

          for (const [index, line] of lines.entries()) {
            const matches = codeLines.has(index)
              ? []
              : line.matchAll(DOTTED_PARAM);

            for (const match of matches) {
              /*
               * Both groups always take part in a match, but TypeScript types
               * `groups` as optional.
               *
               * - Merging onto empty defaults reads them without a fallback
               *   branch that no input can reach.
               */
              const { objectName, tag } = Object.assign(
                { objectName: "", tag: "" },
                match.groups
              );

              const reportedLine = commentStart.line + index;
              const column =
                index === 0
                  ? commentStart.column + BLOCK_DELIMITER_WIDTH + match.index
                  : match.index;

              context.report({
                data: { name: objectName, tag },
                loc: {
                  end: { column: column + match[0].length, line: reportedLine },
                  start: { column, line: reportedLine },
                },
                messageId: "dotted",
              });
            }
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "disallow a dotted TSDoc `@param` name, which documents an object " +
        "param's key where no editor tooltip will ever read it",
      url: "https://github.com/jjloneman/jj-kit/tree/main/packages/eslint-plugin#no-dotted-jsdoc-param",
    },
    /*
     * The rule reads JavaScript comments, so ESLint refuses to run it on a
     * language plugin's files, such as Markdown's, with a config error rather
     * than a crash inside the rule.
     *
     * - `recommended` sets no `files`, so the repo's own `files` beside
     *   `extends` is what keeps it off them.
     */
    languages: ["js/js"],
    messages: {
      dotted:
        "`@{{tag}} {{name}}.<key>` is invisible to IntelliSense — the editor " +
        "shows nothing for that key at the call site, which is the one place " +
        "the doc was for. Put the comment on the property in the type " +
        "literal instead.",
    },
    schema: [],
    type: "problem",
  },
};
