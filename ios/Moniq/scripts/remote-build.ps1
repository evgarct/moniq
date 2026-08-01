param(
    [ValidateSet('project', 'build-ios', 'test-ios', 'ui-test-ios', 'device-install', 'device-deliver', 'all')]
    [string]$Target = 'all',
    [string]$MacHost = $(if ($env:MONIQ_MAC_HOST) { $env:MONIQ_MAC_HOST } elseif ($env:ANQUI_MAC_HOST) { $env:ANQUI_MAC_HOST } else { 'muse-mac' }),
    [string]$Destination = $(if ($env:MONIQ_SIMULATOR_DESTINATION) { $env:MONIQ_SIMULATOR_DESTINATION } else { 'platform=iOS Simulator,name=iPhone 17 Pro' }),
    [string]$DeviceID = $(if ($env:MONIQ_DEVICE_ID) { $env:MONIQ_DEVICE_ID } else { $env:ANQUI_DEVICE_ID }),
    [string]$DevelopmentTeam = $(if ($env:MONIQ_DEVELOPMENT_TEAM) { $env:MONIQ_DEVELOPMENT_TEAM } else { $env:ANQUI_DEVELOPMENT_TEAM })
)

# Mirrors second_brain/scripts/remote-build.ps1: snapshots the working tree,
# ships it to the Mac over scp, and runs the equivalent `make`/device-install
# target over ssh. Falls back to the ANQUI_* env vars (same Mac host, same
# personal-team signing identity) when MONIQ_* ones aren't set.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$tempBase = [IO.Path]::GetTempPath()
$runID = [Guid]::NewGuid().ToString('N')
$tempRoot = Join-Path $tempBase "moniq-ios-remote-build-$runID"
$archivePath = Join-Path $tempRoot 'snapshot.tar.gz'
$fileListPath = Join-Path $tempRoot 'files.txt'
$remoteScriptPath = Join-Path $tempRoot 'remote-build.sh'
$remoteArchive = "/tmp/moniq-ios-remote-build-$runID.tar.gz"
$remoteScript = "/tmp/moniq-ios-remote-build-$runID.sh"

try {
    if ($Target -in @('device-install', 'device-deliver')) {
        if (-not $DeviceID) { throw 'MONIQ_DEVICE_ID/ANQUI_DEVICE_ID or -DeviceID is required for physical-device delivery.' }
        if (-not $DevelopmentTeam) { throw 'MONIQ_DEVELOPMENT_TEAM/ANQUI_DEVELOPMENT_TEAM or -DevelopmentTeam is required for physical-device delivery.' }
    }

    New-Item -ItemType Directory -Path $tempRoot | Out-Null

    # repoRoot is ios/Moniq — snapshot only this subtree, not the whole moniq web repo.
    $files = @(& git -C $repoRoot ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0 -or $files.Count -eq 0) {
        throw 'Could not enumerate the Git snapshot.'
    }

    [IO.File]::WriteAllLines($fileListPath, $files, [Text.UTF8Encoding]::new($false))
    & tar.exe -czf $archivePath -C $repoRoot -T $fileListPath
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not create the remote-build archive.'
    }

    $makeCommands = switch ($Target) {
        'all' { "make build-ios DESTINATION='$Destination'`nmake test-ios DESTINATION='$Destination'`nmake ui-test-ios DESTINATION='$Destination'" }
        'build-ios' { "make build-ios DESTINATION='$Destination'" }
        'test-ios' { "make test-ios DESTINATION='$Destination'" }
        'ui-test-ios' { "make ui-test-ios DESTINATION='$Destination'" }
        'device-install' { "./scripts/build-install-device.sh '$DeviceID' '$DevelopmentTeam'" }
        'device-deliver' { "make test-ios DESTINATION='$Destination'`n./scripts/build-install-device.sh '$DeviceID' '$DevelopmentTeam'" }
        default { "make $Target" }
    }

    $script = @"
#!/usr/bin/env bash
set -euo pipefail
build_dir="`$HOME/Library/Caches/MoniqCodexBuild"
rm -rf "`$build_dir"
mkdir -p "`$build_dir"
tar -xzf '$remoteArchive' -C "`$build_dir"
rm -f '$remoteArchive'
cloud_config="`${MONIQ_CLOUD_CONFIG:-`$HOME/Documents/Moniq/Config/Cloud.local.xcconfig}"
if [[ -f "`$cloud_config" ]]; then
  cp "`$cloud_config" "`$build_dir/Config/Cloud.local.xcconfig"
fi
cd "`$build_dir"
chmod +x scripts/bootstrap-mac.sh
chmod +x scripts/build-install-device.sh
./scripts/bootstrap-mac.sh
$makeCommands
"@
    $script = $script -replace "`r`n", "`n"
    [IO.File]::WriteAllText($remoteScriptPath, $script, [Text.UTF8Encoding]::new($false))

    $ErrorActionPreference = 'Continue'
    & scp $archivePath "${MacHost}:$remoteArchive"
    $snapshotUploadExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($snapshotUploadExitCode -ne 0) { throw 'Snapshot upload failed.' }

    $ErrorActionPreference = 'Continue'
    & scp $remoteScriptPath "${MacHost}:$remoteScript"
    $scriptUploadExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($scriptUploadExitCode -ne 0) { throw 'Remote script upload failed.' }

    $ErrorActionPreference = 'Continue'
    & ssh $MacHost "bash '$remoteScript'; exit_code=`$?; rm -f '$remoteScript'; exit `$exit_code"
    $remoteExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($remoteExitCode -ne 0) { throw "Remote $Target verification failed." }
}
finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    if ($resolvedTemp.StartsWith([IO.Path]::GetFullPath($tempBase), [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $resolvedTemp)) {
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}
