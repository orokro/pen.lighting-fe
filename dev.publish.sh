#!/usr/bin/env bash
set -euo pipefail

# Override defaults for dev publishing
export BUILD_BRANCH="dev_build"
export BUILD_DIR="../pen.lighting-fe-dev-build"
export NPM_BUILD_SCRIPT="build"

# Call the main publish script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/publish.sh"
