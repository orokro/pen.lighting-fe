#!/usr/bin/env bash
set -euo pipefail

# --- Hot-swap env.production with development values ---
if [[ -f .env.production ]]; then
	echo "🔄 Backing up .env.production → .env.production_bak"
	cp .env.production .env.production_bak
fi

echo "📋 Using .env.development as .env.production for dev build"
cp .env.development .env.production

# --- Publish to dev_build branch ---
export BUILD_BRANCH="dev_build"
export BUILD_DIR="../pen.lighting-fe-dev-build"
export NPM_BUILD_SCRIPT="build"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/publish.sh"

# --- Restore original .env.production ---
echo "♻️ Restoring original .env.production"
rm -f .env.production
if [[ -f .env.production_bak ]]; then
	mv .env.production_bak .env.production
fi

echo "✅ Dev publish complete (env.production restored)"
