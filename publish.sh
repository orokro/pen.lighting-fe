#!/usr/bin/env bash
set -euo pipefail

BUILD_BRANCH="${BUILD_BRANCH:-build}"
NPM_BUILD_SCRIPT="${NPM_BUILD_SCRIPT:-build}"

# --- repo root ---
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO_ROOT" ]] || { echo "❌ Not inside a git repo"; exit 1; }
cd "$REPO_ROOT"

# detect worktree path for BUILD_BRANCH
detect_worktree_path() {
  git worktree list --porcelain | awk -v b="refs/heads/${BUILD_BRANCH}" '
    $1=="worktree" { path=$2 }
    $1=="branch" && $2==b { print path }
  '
}
BUILD_DIR="${BUILD_DIR:-$(detect_worktree_path)}"

# create orphan worktree if not present
if [[ -z "${BUILD_DIR}" ]]; then
  DEFAULT_BUILD_DIR="../$(basename "$REPO_ROOT")-build"
  echo "ℹ️  Creating orphan worktree at: ${DEFAULT_BUILD_DIR}"
  git worktree add --orphan "${BUILD_BRANCH}" "${DEFAULT_BUILD_DIR}"
  BUILD_DIR="${DEFAULT_BUILD_DIR}"
  ( cd "${BUILD_DIR}" && git commit --allow-empty -m "init ${BUILD_BRANCH} branch" && git push -u origin "${BUILD_BRANCH}" )
else
  echo "✓ Using existing worktree for '${BUILD_BRANCH}': ${BUILD_DIR}"
fi

# --- WINDOWS/CYGWIN PATH NORMALIZATION ---
# Convert any Windows-style paths (C:\...) to POSIX (/cygdrive/c/...) for rsync
if command -v cygpath >/dev/null 2>&1; then
  REPO_ROOT="$(cygpath -u "$REPO_ROOT")"
  BUILD_DIR="$(cygpath -u "$BUILD_DIR")"
fi

# --- build ---
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
npm run "${NPM_BUILD_SCRIPT}"

DIST_DIR="${REPO_ROOT}/dist"
[[ -d "${DIST_DIR}" ]] || { echo "❌ No dist/ at ${DIST_DIR}"; exit 1; }

# --- sync dist -> worktree ---
echo "⏳ Syncing dist/ → ${BUILD_DIR}"
rsync -a --delete \
  --exclude '.git' --exclude '.gitignore' --exclude '.gitmodules' \
  "${DIST_DIR}/" "${BUILD_DIR}/"

# --- commit & push ---
pushd "${BUILD_DIR}" >/dev/null
if git diff --quiet && git diff --cached --quiet; then
  echo "ℹ️  No changes to deploy."
else
  git add -A
  git commit -m "Deploy $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
  git push origin "${BUILD_BRANCH}"
  echo "✅ Deployed to branch '${BUILD_BRANCH}'."
fi
popd >/dev/null
