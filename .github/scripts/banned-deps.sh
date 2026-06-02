#!/usr/bin/env bash
set -euo pipefail

# CI / banned-deps
# Fails if an unapproved third-party package appears without review.
# Approved stack: PROJECT_SPEC §4 (Riverpod for Flutter state; React/Recharts
# for admin web). Alternate state-management and UI-kit libraries require an
# explicit review before they may be added — extend these lists in that PR.

FLUTTER_BANNED='provider|bloc|flutter_bloc|getx|get_it|mobx|flutter_mobx|redux|flutter_redux|getwidget|fluttertoast'
JS_BANNED='redux|@reduxjs/toolkit|mobx|recoil|@mui/material|antd|@chakra-ui/react|bootstrap|@mantine/core|styled-components'

fail=0

while IFS= read -r f; do
  if hits=$(grep -nE "^[[:space:]]+(${FLUTTER_BANNED}):" "$f" 2>/dev/null); then
    echo "Unapproved Flutter dependency in $f:"; echo "$hits"; fail=1
  fi
done < <(find apps packages -name pubspec.yaml -not -path '*/.*/*' 2>/dev/null)

while IFS= read -r f; do
  if hits=$(grep -nE "\"(${JS_BANNED})\"[[:space:]]*:" "$f" 2>/dev/null); then
    echo "Unapproved JS dependency in $f:"; echo "$hits"; fail=1
  fi
done < <(find apps packages -name package.json -not -path '*/node_modules/*' 2>/dev/null)

if [ "$fail" -ne 0 ]; then
  echo "::error::Unapproved dependency detected — review required (PROJECT_SPEC §4)."
  exit 1
fi
echo "banned-deps: OK."
