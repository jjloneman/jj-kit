#!/usr/bin/env bash

# Prints `ships=true` when a Renovate PR changes what a package ships, else
# `ships=false`, for CI's `🦋 Changeset` job; #5 replaces it with the kit's
# `require-changeset` action.
#
# - A package ships a change when its `dependencies`, `optionalDependencies`,
#   `peerDependencies` or `engines` change, a `catalog:` entry they point to
#   included; a dev dependency or a root bump ships nothing.
#
# - It compares the PR's merge commit (`HEAD`) with its base parent (`HEAD^1`),
#   so a `main` that moved on since doesn't count as the PR's change.
#
# - Any error fails the script rather than printing `ships=false`, so a broken
#   check never skips the changeset.

set -euo pipefail
shopt -s inherit_errexit

# Resolves a manifest's `catalog:` specs against the workspace's catalogs, and
# keeps only the fields that change what a package ships.
readonly SHIPPED_FIELDS='
  def resolve($name; $spec):
    if ($spec | type) == "string" and ($spec | startswith("catalog:")) then
      ($spec | ltrimstr("catalog:")) as $catalog
      | if $catalog == "" or $catalog == "default" then
          { catalog: ($ws.catalog[$name] // $ws.catalogs.default[$name]) }
        else
          { catalog: $ws.catalogs[$catalog][$name] }
        end
    else
      $spec
    end;

  . as $manifest
  | {
      ($path): (
        { engines: $manifest.engines }
        + (
          ["dependencies", "optionalDependencies", "peerDependencies"]
          | map(
            . as $field
            | {
                ($field): (
                  ($manifest[$field] // {})
                  | with_entries(.value = resolve(.key; .value))
                ),
              }
          )
          | add
        )
      ),
    }
'

# Prints, as one sorted JSON object, the shipped fields of every package at a
# revision, keyed by manifest path.
snapshot() {
  local manifest
  local manifests
  local revision="$1"
  local workspace

  workspace=$(
    git show "$revision:pnpm-workspace.yaml" \
      | yq -o json \
        '{"catalog": (.catalog // {}), "catalogs": (.catalogs // {})}'
  )

  # Every package's manifest, one level under `packages/`; none is fine.
  manifests=$(
    git ls-tree -r --name-only "$revision" -- packages \
      | { grep -E '^packages/[^/]+/package\.json$' || true; }
  )

  for manifest in $manifests; do
    git show "$revision:$manifest" \
      | jq --arg path "$manifest" --argjson ws "$workspace" "$SHIPPED_FIELDS"
  done | jq -s -S 'add // {}'
}

before=$(snapshot HEAD^1)
after=$(snapshot HEAD)

if [ "$before" = "$after" ]; then
  echo "ships=false"
else
  echo "ships=true"
fi
