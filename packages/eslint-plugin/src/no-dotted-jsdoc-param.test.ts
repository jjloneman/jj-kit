import { RuleTester } from "eslint";
import { describe, test } from "vitest";

import { NO_DOTTED_JSDOC_PARAM } from "./no-dotted-jsdoc-param.ts";

/*
 * RuleTester calls `describe` and `it` itself, so hand it Vitest's.
 *
 * - Espree, the default parser, is enough: the rule reads comments, never the
 *   AST, so the fixtures are plain JavaScript.
 */
RuleTester.describe = describe;
RuleTester.it = test;
RuleTester.itOnly = test.only;

/** Runs the rule's cases, one Vitest test each. */
const RULE_TESTER = new RuleTester();

RULE_TESTER.run("no-dotted-jsdoc-param", NO_DOTTED_JSDOC_PARAM, {
  invalid: [
    {
      code: [
        "/**",
        " * Formats a label.",
        " *",
        " * @param options.prefix - the text before the label.",
        " */",
        "function label(options) {",
        "  return options.prefix;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 4,
          data: { name: "options", tag: "param" },
          endColumn: 25,
          endLine: 4,
          line: 4,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param, underlined from the @ to the key's end",
    },
    {
      code: [
        "/**",
        " * Saves a file.",
        " *",
        " * @param file.bytes - the contents.",
        " * @param file.kind - the media type.",
        " */",
        "function save(file) {",
        "  return file.bytes;",
        "}",
      ].join("\n"),
      errors: [
        { line: 4, messageId: "dotted" },
        { line: 5, messageId: "dotted" },
      ],
      name: "two dotted @params on consecutive lines, each on its own",
    },
    {
      code: [
        "/** @param props.size - a size. */",
        "function render(props) {",
        "  return props.size;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 5,
          data: { name: "props", tag: "param" },
          endColumn: 22,
          line: 1,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param on a comment's first line, past the stripped /*",
    },
    {
      code: [
        "const handlers = {",
        "  /** @param input.id - an id. */",
        "  run(input) {",
        "    return input.id;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ column: 7, endColumn: 22, line: 2, messageId: "dotted" }],
      name: "a dotted @param on an indented comment's first line",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @param {Object} options - the options.",
        " * @param {string} options.mode - the mode to run in.",
        " */",
        "function run(options) {",
        "  return options.mode;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 4,
          data: { name: "options", tag: "param" },
          endColumn: 32,
          line: 5,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param behind a JSDoc {type}",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @param [options.retries] - how many times to retry.",
        " */",
        "function run(options) {",
        "  return options.retries;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 4,
          data: { name: "options", tag: "param" },
          endColumn: 27,
          line: 4,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param in the optional [name] form",
    },
    {
      code: [
        "/**",
        "   @param params.key - no asterisk on this line.",
        " */",
        "function read(params) {",
        "  return params.key;",
        "}",
      ].join("\n"),
      errors: [{ column: 4, endColumn: 21, line: 2, messageId: "dotted" }],
      name: "a dotted @param on a line with no asterisk",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @param options.retry.limit - the most attempts to make.",
        " */",
        "function run(options) {",
        "  return options.retry.limit;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 4,
          data: { name: "options", tag: "param" },
          endColumn: 30,
          line: 4,
          messageId: "dotted",
        },
      ],
      name: "a nested dotted @param, naming the outermost object",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @param options.verbose - whether to log every step of the task,",
        " *   wrapped onto a second line.",
        " */",
        "function run(options) {",
        "  return options.verbose;",
        "}",
      ].join("\n"),
      errors: [{ line: 4, messageId: "dotted" }],
      name: "a dotted @param with a wrapped description, once",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @param {{ retries: number }} options.retries - how often to retry.",
        " */",
        "function run(options) {",
        "  return options.retries;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 4,
          data: { name: "options", tag: "param" },
          endColumn: 48,
          line: 4,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param behind a {type} with nested braces",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * ```js",
        " * @param example.key - shown, not documented.",
        " * ```",
        " *",
        " * @param options.mode - the mode to run in.",
        " */",
        "function run(options) {",
        "  return options.mode;",
        "}",
      ].join("\n"),
      errors: [{ line: 8, messageId: "dotted" }],
      name: "a dotted @param after a code fence closes, but not inside it",
    },
    {
      code: [
        "/**",
        " * Runs a task.\r *",
        " * @param options.mode - the mode to run in.\u2028 *",
        " * @param options.level - how loud to be.",
        " */",
        "function run(options) {",
        "  return options.mode;",
        "}",
      ].join("\n"),
      errors: [
        { line: 4, messageId: "dotted" },
        { line: 6, messageId: "dotted" },
      ],
      name: "dotted @params after a lone \\r and a U+2028, on ESLint's lines",
    },
    {
      code: [
        "/**",
        " * ```run()``` starts it.",
        " * @param options.mode - the mode to run in.",
        " */",
        "function run(options) {",
        "  return options.mode;",
        "}",
      ].join("\n"),
      errors: [{ line: 3, messageId: "dotted" }],
      name: "a dotted @param after an inline code span, which opens no fence",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * ~~~",
        " * @param tilde.key - TSDoc has no tilde fences.",
        " * ````",
        " * @param long.key - nor longer backtick fences.",
        " *  ```",
        " * @param indented.key - nor indented ones.",
        " * ```ts",
        " * @param unclosed.key - nor one that never closes.",
        " */",
      ].join("\n"),
      errors: [
        { data: { name: "tilde", tag: "param" }, line: 5, messageId: "dotted" },
        { data: { name: "long", tag: "param" }, line: 7, messageId: "dotted" },
        {
          data: { name: "indented", tag: "param" },
          line: 9,
          messageId: "dotted",
        },
        {
          data: { name: "unclosed", tag: "param" },
          line: 11,
          messageId: "dotted",
        },
      ],
      name: "dotted @params past lines TSDoc doesn't read as an open fence",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * ```",
        " * @param example.key - shown, not documented.",
        " * ``` closes it, though TSDoc warns.",
        " * @param options.mode - the mode to run in.",
        " */",
      ].join("\n"),
      errors: [{ line: 7, messageId: "dotted" }],
      name: "a dotted @param after a fence closed by a line with text after it",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " *     @param options.mode - indented, but still a tag to TSDoc.",
        " */",
      ].join("\n"),
      errors: [{ column: 8, line: 4, messageId: "dotted" }],
      name: "an indented dotted @param, since TSDoc has no indented code",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @arg options.mode - the mode to run in.",
        " * @argument options.level - how loud to be.",
        " */",
        "function run(options) {",
        "  return options.mode;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 4,
          data: { name: "options", tag: "arg" },
          endColumn: 21,
          line: 4,
          messageId: "dotted",
        },
        {
          data: { name: "options", tag: "argument" },
          line: 5,
          messageId: "dotted",
        },
      ],
      name: "dotted @arg and @argument aliases, quoted as written",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @param [ options.retries ] - how many times to retry.",
        " * @param café.size - a Unicode name.",
        " */",
        "function run(options, café) {",
        "  return options.retries + café.size;",
        "}",
      ].join("\n"),
      errors: [
        {
          data: { name: "options", tag: "param" },
          line: 4,
          messageId: "dotted",
        },
        { data: { name: "café", tag: "param" }, line: 5, messageId: "dotted" },
      ],
      name: "a dotted @param with spaces in its brackets, or a Unicode name",
    },
    {
      code: [
        "/**",
        " * Saves the staff list.",
        " *",
        " * @param {Object[]} employees - the staff.",
        " * @param {string} employees[].name - each one's name.",
        " */",
        "function save(employees) {",
        "  return employees;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 4,
          data: { name: "employees", tag: "param" },
          endColumn: 36,
          line: 5,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param on an array's elements, JSDoc's name[].key",
    },
    {
      code: [
        "/**",
        " * Runs a task.",
        " *",
        " * @param {{ retry: { limit: number } }} options.retry - the limits.",
        " */",
        "function run(options) {",
        "  return options.retry;",
        "}",
      ].join("\n"),
      errors: [
        {
          data: { name: "options", tag: "param" },
          line: 4,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param behind a {type} two levels of braces deep",
    },
    {
      code: [
        "/** Formats a label. @param options.prefix - the prefix. */",
        "function label(options) {",
        "  return options.prefix;",
        "}",
      ].join("\n"),
      errors: [
        {
          column: 22,
          data: { name: "options", tag: "param" },
          endColumn: 43,
          line: 1,
          messageId: "dotted",
        },
      ],
      name: "a dotted @param after a single-line block's summary",
    },
    {
      code: [
        "/**",
        " * Moves a box. @param box.x - across. @param box.y - down.",
        " */",
        "function move(box) {",
        "  return box.x + box.y;",
        "}",
      ].join("\n"),
      errors: [
        { column: 17, endColumn: 29, line: 2, messageId: "dotted" },
        { column: 40, endColumn: 52, line: 2, messageId: "dotted" },
      ],
      name: "two dotted @params on one line, each on its own",
    },
  ],
  valid: [
    {
      code: [
        "/**",
        " * Checks a setting.",
        " *",
        " * @param setting - the setting to check.",
        " * @returns whether it holds.",
        " */",
        "function isOn(setting) {",
        "  return Boolean(setting);",
        "}",
      ].join("\n"),
      name: "a positional @param",
    },
    {
      code: [
        "/**",
        " * Checks a setting.",
        " *",
        " * @param {Object} setting - the setting to check.",
        " */",
        "function isOn(setting) {",
        "  return Boolean(setting);",
        "}",
      ].join("\n"),
      name: "a positional @param behind a JSDoc {type}",
    },
    {
      code: [
        "/**",
        " * Reads a file.",
        " *",
        " * @param path - a path such as config.path, relative to the root.",
        " */",
        "function read(path) {",
        "  return path;",
        "}",
      ].join("\n"),
      name: "a positional @param whose description holds a dotted name",
    },
    {
      code: [
        "const sizes = {",
        "  /** The width of the frame, in pixels. */",
        "  width: 640,",
        "};",
      ].join("\n"),
      name: "a key documented on the property itself",
    },
    {
      code: [
        "/*",
        " * @param params.key - not a doc comment.",
        " */",
        "const noop = () => {};",
      ].join("\n"),
      name: "a plain block comment",
    },
    {
      code: [
        "// @param params.key - not a doc comment.",
        "const noop = () => {};",
      ].join("\n"),
      name: "a line comment",
    },
    {
      code: [
        "/**",
        " * Shows the form this rule reports.",
        " *",
        " * @example",
        " * ```ts",
        " * @param options.key - an example, not a doc.",
        " * ```",
        " */",
        "const example = 1;",
      ].join("\n"),
      name: "a dotted @param inside an @example code fence",
    },
    {
      code: [
        "/**",
        "Runs a task.",
        "",
        "@example",
        "```ts",
        "@param example.key - shown, not documented.",
        "```",
        " */",
        "const example = 1;",
      ].join("\n"),
      name: "a dotted @param inside a fence in a block with no asterisks",
    },
    {
      code: [
        "/**",
        " * @param value - a value.",
        " ".repeat(100_000),
        " */",
        "const example = 1;",
      ].join("\n"),
      name: "a line of 100,000 spaces with no *, scanned in linear time",
    },
    {
      code: [
        "/**",
        " * Quotes `@param options.key` as code; see also foo@param a.b.",
        " */",
        "const contact = 1;",
      ].join("\n"),
      name: "a dotted @param in an inline code span, or glued to a word",
    },
    {
      code: 'const doc = "@param params.key - a string, not a comment.";',
      name: "a string literal",
    },
  ],
});
