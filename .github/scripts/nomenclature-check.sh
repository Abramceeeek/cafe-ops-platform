#!/usr/bin/env bash
set -euo pipefail

# CI / nomenclature-check
# Enforces PROJECT_SPEC §1.1 nomenclature in UI source: use Shop / Hub / Courier.
# Banned user-facing terms: "customer", "driver" (whole word, case-insensitive).
#
# NOTE: "client" is intentionally NOT banned here — it collides with legitimate
# SDK identifiers (supabase client, http client) and the spec itself uses
# "client" to mean the business owner. Tighten to UI string literals later if
# desired.

BANNED='customer|driver'
PATHS=(apps/shop_app/lib apps/hub_app/lib apps/admin_web/app apps/admin_web/components packages)

violations=0
for p in "${PATHS[@]}"; do
  [ -d "$p" ] || continue
  if matches=$(grep -rniE "\b(${BANNED})s?\b" "$p" \
        --include='*.dart' --include='*.ts' --include='*.tsx' \
        --include='*.js' --include='*.jsx' 2>/dev/null); then
    echo "$matches"
    violations=$((violations + $(printf '%s\n' "$matches" | grep -c '')))
  fi
done

if [ "$violations" -gt 0 ]; then
  echo "::error::Banned nomenclature found ($violations match(es)). Use Shop / Hub / Courier (PROJECT_SPEC §1.1)."
  exit 1
fi
echo "nomenclature-check: OK — no banned terms in UI source."
