#!/usr/bin/env bash

# Fails with a clear message when Node is older than 26, which the actions'
# TypeScript needs for type stripping; the runner's default Node may be older.
#
# - Takes the action's name, for the message.

set -euo pipefail

major=$(node -p 'process.versions.node.split(".")[0]')

if [ "$major" -lt 26 ]; then
  echo "::error::$1 needs Node 26 or later, but found $(node --version)." \
    "Run your setup step before it."
  exit 1
fi
