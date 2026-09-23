#!/usr/bin/env bash
# Symlink the frappe-app-dev skill into the agent skill roots that exist.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/frappe-app-dev"
[ -d "$SRC" ] || { echo "missing: $SRC" >&2; exit 1; }

linked=0
for root in "$HOME/.claude/skills" "$HOME/.omp/agent/skills"; do
  [ -d "$root" ] || continue
  target="$root/frappe-app-dev"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "refusing to replace real directory: $target" >&2
    exit 1
  fi
  ln -sfn "$SRC" "$target"
  echo "linked $target -> $SRC"
  linked=$((linked + 1))
done

[ "$linked" -gt 0 ] || { echo "no skill root found (~/.claude/skills)" >&2; exit 1; }
