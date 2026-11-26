import { afterEach, describe, expect, test, vi } from "vitest";

import { annotate, describeError } from "./annotate.ts";

describe("annotate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("prints the annotation, escaping percent signs and line breaks", () => {
    // Given - a message with characters the runner would misread.
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // When - it's annotated.
    annotate({ level: "warning", message: "50%\r\ndone" });

    // Then - they're escaped as workflow commands require.
    expect(log).toHaveBeenCalledWith("::warning::50%25%0D%0Adone");
  });
});

describe("describeError", () => {
  test.each([
    { description: "an error", error: new Error("boom"), expected: "boom" },
    { description: "a string", error: "odd", expected: "odd" },
    { description: "a number", error: 42, expected: "42" },
  ])("describes $description", ({ error, expected }) => {
    // Given - a caught value.

    // When - it's described.
    const text = describeError(error);

    // Then - it reads as text.
    expect(text).toBe(expected);
  });
});
