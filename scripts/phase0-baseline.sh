#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

required_major=24
actual_major="$(node -p 'process.versions.node.split(".")[0]')"

if (( actual_major < required_major )); then
  echo "FAIL: Sellify requires Node >= ${required_major}; found $(node --version)."
  exit 2
fi

echo "PASS: Node runtime $(node --version)"

failed=0
while IFS= read -r file; do
  if ! node --check "$file" >/dev/null; then
    echo "FAIL: syntax $file"
    failed=1
  fi
done < <(find app backend -type f -name '*.js' | sort)

if (( failed != 0 )); then
  exit 1
fi

echo "PASS: JavaScript syntax baseline"
echo "PASS: Phase 0 baseline checks completed"
