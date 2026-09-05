#!/usr/bin/env bash
#
# Runs the Maestro suite from a known-good starting point.
#
# Every flow reinstalls the app (`launchApp: clearState`), so app state is
# already isolated per flow. What is not isolated is everything *outside* the
# app: the Simulator's appearance, Dynamic Type size and language, plus the
# Supabase fixtures. Those are what this script resets, so a suite run cannot
# inherit whatever a manual session or a `docs`-tagged flow left behind — both
# of those change appearance and content size on purpose and never put them
# back, and Maestro has no way to set either from inside a flow.
#
# Usage, from anywhere:
#   SUPABASE_KEYS_JSON=/tmp/keys.json apps/mobile/scripts/e2e.sh
#   SUPABASE_KEYS_JSON=/tmp/keys.json apps/mobile/scripts/e2e.sh .maestro/phase5-add-equal.yaml
#
# Environment:
#   MAESTRO      path to the maestro binary (default: the first one that exists)
#   DEVICE       Simulator name (default: "iPhone 17 Pro")
#   SKIP_SEED=1  keep the current fixtures instead of reseeding
set -euo pipefail

DEVICE="${DEVICE:-iPhone 17 Pro}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${MAESTRO:-}" ]; then
  for candidate in \
    "$(command -v maestro || true)" \
    "$HOME/.maestro/bin/maestro" \
    /tmp/maestro-dist/maestro/bin/maestro; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then MAESTRO="$candidate"; break; fi
  done
fi
if [ -z "${MAESTRO:-}" ]; then
  echo "maestro not found; set MAESTRO=/path/to/maestro" >&2
  exit 1
fi

UDID="$(xcrun simctl list devices available |
  grep -F "$DEVICE (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')"
if [ -z "$UDID" ]; then
  echo "no available Simulator named \"$DEVICE\"" >&2
  exit 1
fi

echo "==> booting $DEVICE ($UDID)"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" >/dev/null

# A stale ja/zh-Hant device language renames the system buttons the flows tap
# ("Delete", "Not Now", "Open"). The preference is only read at boot, so a wrong
# one costs a restart rather than being silently ignored.
LANGS="$(xcrun simctl spawn "$UDID" defaults read .GlobalPreferences AppleLanguages 2>/dev/null | tr -d ' \n' || true)"
case "$LANGS" in
  \(\"en*|\(en*) ;;
  *)
    echo "==> device language is $LANGS; pinning to en and restarting"
    xcrun simctl spawn "$UDID" defaults write .GlobalPreferences AppleLanguages -array en
    xcrun simctl spawn "$UDID" defaults write .GlobalPreferences AppleLocale -string en_US
    xcrun simctl shutdown "$UDID"
    xcrun simctl boot "$UDID"
    xcrun simctl bootstatus "$UDID" >/dev/null
    ;;
esac

echo "==> resetting Simulator appearance and Dynamic Type"
xcrun simctl ui "$UDID" appearance light
xcrun simctl ui "$UDID" content_size medium

if [ "${SKIP_SEED:-0}" != "1" ]; then
  echo "==> reseeding fixtures"
  node --experimental-strip-types "$APP_DIR/scripts/seed-dev.ts"
  node --experimental-strip-types "$APP_DIR/scripts/temp-account.ts" create
fi

TARGET="${1:-.maestro/}"
echo "==> maestro test --exclude-tags=docs $TARGET"
cd "$APP_DIR"
status=0
"$MAESTRO" test --exclude-tags=docs "$TARGET" || status=$?

if [ "${SKIP_SEED:-0}" != "1" ]; then
  echo "==> checking the delete-account fixture was consumed"
  node --experimental-strip-types "$APP_DIR/scripts/temp-account.ts" check || status=$?
fi

exit "$status"
