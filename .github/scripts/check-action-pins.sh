#!/usr/bin/env bash

# Fails when a third-party `uses:` pin's SHA isn't the commit its `# vX.Y.Z`
# tag points to on that action's own repo.
#
# - ESLint's `local/pinned-uses` checks the pin's form; this checks its value,
#   which needs the network, so it runs in CI rather than in `pnpm lint`.
#
# - A well-formed SHA can still be the wrong one, copied from another tag or
#   repo, so the form check alone isn't enough.
#
# - Reads `actions/*/action.yml` and `.github/workflows/*.yml` from the
#   current directory, and needs `gh` with a token in `GH_TOKEN`.

set -euo pipefail

# One `<owner>/<repo>[/<path>]@<sha> # vX.Y.Z` pin, captured as repo, SHA, tag.
readonly PIN='uses:[[:space:]]+([^/[:space:]]+/[^/@[:space:]]+)[^@[:space:]]*@([0-9a-f]{40})[[:space:]]+#[[:space:]]+(v[0-9]+\.[0-9]+\.[0-9]+)$'

failures=0
checked=0

while IFS=: read -r file line text; do
  if [[ ! $text =~ $PIN ]]; then
    continue
  fi

  repo=${BASH_REMATCH[1]}
  sha=${BASH_REMATCH[2]}
  tag=${BASH_REMATCH[3]}
  checked=$((checked + 1))

  if ! actual=$(gh api "repos/$repo/commits/$tag" --jq .sha); then
    echo "::error file=$file,line=$line::$repo has no tag $tag." >&2
    failures=$((failures + 1))
  elif [[ $actual != "$sha" ]]; then
    echo "::error file=$file,line=$line::$repo $tag is $actual, not $sha." >&2
    failures=$((failures + 1))
  fi
done < <(grep -nE 'uses:' actions/*/action.yml .github/workflows/*.yml)

echo "Checked $checked pins; $failures don't match their tags."

if ((failures > 0)); then
  exit 1
fi
