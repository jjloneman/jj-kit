import { describe, expect, test } from "vitest";

import { parseReleasePlan } from "./release-plan.ts";

describe("parseReleasePlan", () => {
  test("reads the changesets and releases", () => {
    // Given - a release plan as `changeset status` writes it.
    const text = JSON.stringify({
      changesets: [
        { id: "bump-node-26.1", releases: [], summary: "Docs." },
        { id: "pre/brave-cats", releases: [], summary: "Pre." },
      ],
      preState: undefined,
      releases: [{ name: "b", type: "minor" }],
    });

    // When - it's parsed.
    const plan = parseReleasePlan(text);

    // Then - both lists come through, a dotted id included.
    expect(plan).toStrictEqual({
      changesets: [
        { id: "bump-node-26.1", releases: [], summary: "Docs." },
        { id: "pre/brave-cats", releases: [], summary: "Pre." },
      ],
      releases: [{ name: "b", type: "minor" }],
    });
  });

  test.each([
    { description: "null", text: "null" },
    { description: "a number", text: "1" },
    { description: "no changesets", text: '{"releases":[]}' },
    { description: "no releases", text: '{"changesets":[]}' },
    {
      description: "changesets that isn't a list",
      text: '{"changesets":{},"releases":[]}',
    },
    {
      description: "releases that isn't a list",
      text: '{"changesets":[],"releases":{}}',
    },
    {
      description: "a changeset that isn't an object",
      text: '{"changesets":[null],"releases":[]}',
    },
    {
      description: "a changeset without an id",
      text: '{"changesets":[{"releases":[]}],"releases":[]}',
    },
    {
      description: "a changeset without releases",
      text: '{"changesets":[{"id":"a"}],"releases":[]}',
    },
    {
      description: "an id that isn't a string",
      text: '{"changesets":[{"id":1,"releases":[]}],"releases":[]}',
    },
    {
      description: "an empty id",
      text: '{"changesets":[{"id":"","releases":[]}],"releases":[]}',
    },
    {
      description: "a dot id",
      text: '{"changesets":[{"id":".","releases":[]}],"releases":[]}',
    },
    {
      description: "a dot-dot id",
      text: '{"changesets":[{"id":"..","releases":[]}],"releases":[]}',
    },
    {
      description: "an id with a slash",
      text: '{"changesets":[{"id":"a/b","releases":[]}],"releases":[]}',
    },
    {
      description: "an id nested under pre/",
      text: '{"changesets":[{"id":"pre/a/b","releases":[]}],"releases":[]}',
    },
    {
      description: "an id with a backslash",
      text: String.raw`{"changesets":[{"id":"a\\b","releases":[]}],"releases":[]}`,
    },
    {
      description: "changeset releases that isn't a list",
      text: '{"changesets":[{"id":"a","releases":{}}],"releases":[]}',
    },
    {
      description: "a release that isn't an object",
      text: '{"changesets":[],"releases":[null]}',
    },
    {
      description: "a release without a name",
      text: '{"changesets":[],"releases":[{"type":"minor"}]}',
    },
    {
      description: "a release without a type",
      text: '{"changesets":[],"releases":[{"name":"a"}]}',
    },
    {
      description: "a release whose name isn't a string",
      text: '{"changesets":[],"releases":[{"name":1,"type":"minor"}]}',
    },
    {
      description: "a release whose type isn't a string",
      text: '{"changesets":[],"releases":[{"name":"a","type":1}]}',
    },
  ])("rejects $description", ({ text }) => {
    // Given - a file that isn't a release plan of the expected shape.

    // When - it's parsed.
    const parse = (): unknown => parseReleasePlan(text);

    // Then - it throws rather than guess.
    expect(parse).toThrow("changeset status wrote no");
  });
});
