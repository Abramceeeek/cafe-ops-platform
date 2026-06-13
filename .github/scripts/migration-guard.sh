#!/usr/bin/env bash
set -euo pipefail

# CI / db-migration-guard
# Enforces PROJECT_SPEC §5: a committed migration is immutable — never edit it,
# always add a new numbered file. Also checks migrations are .sql files.
# BASE_REF (env) is the commit to diff against (PR base sha or push "before").

MIG_DIR=supabase/migrations

if [ ! -d "$MIG_DIR" ]; then
  echo "db-migration-guard: no migrations dir — skipping."
  exit 0
fi

BASE_REF="${BASE_REF:-}"
if [ -z "$BASE_REF" ] || ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "db-migration-guard: no valid base ref ('$BASE_REF') — skipping immutability diff."
else
  modified=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    # File changed AND existed in base = forbidden edit of a committed migration.
    if git cat-file -e "$BASE_REF:$f" 2>/dev/null; then
      modified="$modified$f"$'\n'
    fi
  done < <(git diff --name-only "$BASE_REF"...HEAD -- "$MIG_DIR")

  if [ -n "$modified" ]; then
    echo "::error::Existing migration(s) modified — migrations are immutable (PROJECT_SPEC §5). Add a new numbered migration instead:"
    printf '%s' "$modified"
    exit 1
  fi
fi

bad=$(find "$MIG_DIR" -type f ! -name '*.sql' ! -name 'README.md' 2>/dev/null || true)
if [ -n "$bad" ]; then
  echo "::error::Non-SQL file(s) in $MIG_DIR (migrations must be *.sql):"
  echo "$bad"
  exit 1
fi

# Duplicate migration-number guard (audit 2026-06-13 H6). Two legacy duplicate
# prefixes (0040, 0041) predate this check and are already applied live; renaming
# them would trip the immutability diff above, so they are allow-listed. Any NEW
# duplicate number fails CI.
LEGACY_DUP_ALLOW=" 0040 0041 "
dups=$(find "$MIG_DIR" -maxdepth 1 -name '*.sql' -exec basename {} \; | grep -oE '^[0-9]+' | sort | uniq -d || true)
for d in $dups; do
  case "$LEGACY_DUP_ALLOW" in
    *" $d "*) echo "db-migration-guard: legacy duplicate prefix $d (allow-listed)." ;;
    *)
      echo "::error::Duplicate migration number $d — each numbered migration must be unique (PROJECT_SPEC §5)."
      exit 1
      ;;
  esac
done

echo "db-migration-guard: OK."
