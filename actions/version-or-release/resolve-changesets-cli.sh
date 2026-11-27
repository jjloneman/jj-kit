#!/usr/bin/env bash

# Prints the path of `@changesets/cli/bin.js`, resolved from the current
# directory as changesets/action v2.1.2 resolves it, or fails naming the cause.
#
# - Takes the caller's name, for the message.
#
# - Its messages go to stderr, since callers capture or discard stdout; the
#   runner reads workflow commands from both.
#
# - jj-kit's `ci.yml` runs it too, so a PR's CI exercises the action's check.

set -euo pipefail

title=${1:-resolve-changesets-cli}

if ! command -v node > /dev/null; then
  echo "::error title=$title::node isn't on PATH." \
    "Run your setup step first." >&2
  exit 1
fi

if ! node -p 'require.resolve("@changesets/cli/bin.js",
  { paths: [process.cwd()] })'; then
  echo "::error title=$title::@changesets/cli doesn't resolve from the repo" \
    "root. Install it there first; with setup's install: root, list it in" \
    "the root package.json's dependencies, since that install skips" \
    "devDependencies." >&2
  exit 1
fi
