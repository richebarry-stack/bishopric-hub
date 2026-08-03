#!/usr/bin/env bash
# Deploys dist/ to the bishopric-hub-demo Pages project with the correct D1 binding.
#
# `wrangler pages deploy` has no --config flag for Pages projects — it always reads
# the root wrangler.jsonc, which points at the real production database. Deploying
# the demo project without this script silently rebinds it to production data (this
# happened once already). This script swaps wrangler.jsonc for wrangler.demo.jsonc
# only for the duration of the deploy, and restores it afterward no matter what.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f wrangler.jsonc ] || [ ! -f wrangler.demo.jsonc ]; then
  echo "wrangler.jsonc and wrangler.demo.jsonc must both exist (copy from their .example files)." >&2
  exit 1
fi

backup=$(mktemp)
cp wrangler.jsonc "$backup"
restore() { cp "$backup" wrangler.jsonc; rm -f "$backup"; }
trap restore EXIT

cp wrangler.demo.jsonc wrangler.jsonc
npx wrangler pages deploy dist --project-name=bishopric-hub-demo --branch=demo
