#!/usr/bin/env bash
set -euo pipefail

device_id="${1:-${MONIQ_DEVICE_ID:-${ANQUI_DEVICE_ID:-}}}"
development_team="${2:-${MONIQ_DEVELOPMENT_TEAM:-${ANQUI_DEVELOPMENT_TEAM:-}}}"
# Reuses the existing AnquiBuild keychain rather than provisioning a separate
# MoniqBuild one: it's the same personal-team Apple Development identity
# signing every app for this account, so a second keychain would just
# duplicate the same exported identity. Run scripts/setup-mac-signing.sh from
# the second_brain repo once if this keychain doesn't exist yet.
keychain="$HOME/Library/Keychains/AnquiBuild.keychain-db"
password_file="$HOME/.config/anqui/build-keychain-password"
derived_data="$HOME/Library/Developer/Xcode/DerivedData/MoniqCodexDevice"
log_directory="$HOME/Library/Logs/Moniq"
build_log="$log_directory/device-build.log"
app="$derived_data/Build/Products/Debug-iphoneos/Moniq.app"

if [[ -z "$device_id" || -z "$development_team" ]]; then
  echo "CoreDevice ID and development team are required." >&2
  exit 2
fi
if [[ ! -f "$keychain" || ! -f "$password_file" ]]; then
  echo "Build signing keychain is not configured. Run scripts/setup-mac-signing.sh in the second_brain repo (shared personal-team identity) first." >&2
  exit 3
fi

mkdir -p "$log_directory"
keychain_password="$(cat "$password_file")"
trap 'unset keychain_password' EXIT
security unlock-keychain -p "$keychain_password" "$keychain"

NSUnbufferedIO=YES xcodebuild \
  -project Moniq.xcodeproj \
  -scheme Moniq \
  -configuration Debug \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$derived_data" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$development_team" \
  CODE_SIGN_STYLE=Automatic \
  build 2>&1 | tee "$build_log"

codesign --verify --deep --strict "$app"
profile_team="$(security cms -D -i "$app/embedded.mobileprovision" 2>/dev/null | plutil -extract TeamIdentifier.0 raw -)"
if [[ "$profile_team" != "$development_team" ]]; then
  echo "Built profile team $profile_team does not match configured team $development_team." >&2
  exit 4
fi

for key in MoniqSupabaseURL; do
  value="$(plutil -extract "$key" raw -o - "$app/Info.plist" 2>/dev/null || true)"
  if [[ -z "$value" ]]; then
    echo "Built app is missing $key. Configure Config/Cloud.local.xcconfig on the Mac before device delivery." >&2
    exit 5
  fi
done

xcrun devicectl device install app --device "$device_id" "$app"
xcrun devicectl device process launch --device "$device_id" com.evgarct.moniq

echo "Moniq was built, signed, installed, and launched successfully."
