#!/usr/bin/env bash
set -euo pipefail

# CI / rls-tenant-isolation  (HEURISTIC — tunable)
# Backstop reminder for PROJECT_SPEC §6.2 / C8 / C9: Edge Functions that read or
# write data must scope by tenant (shop_id) and/or role. RLS at the DB is the
# authoritative gate; this is a static nudge, not a replacement. Refine the
# detection as the backend grows.

DIRS=(supabase/functions)
fail=0

for d in "${DIRS[@]}"; do
  [ -d "$d" ] || continue
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if ! grep -qE 'shop_id|role|auth\.uid|current_shop_id|current_role' "$f"; then
      echo "Possible unscoped data access (no shop_id/role reference): $f"
      grep -nE '\.from\(' "$f" || true
      fail=1
    fi
  done < <(grep -rlE '\.from\(' "$d" --include='*.ts' --include='*.js' 2>/dev/null || true)
done

if [ "$fail" -ne 0 ]; then
  echo "::error::Edge Function does DB access without visible tenant/role scoping — verify RLS + scoping (PROJECT_SPEC §6.2)."
  exit 1
fi
echo "rls-tenant-isolation: OK — no unscoped data access detected."
