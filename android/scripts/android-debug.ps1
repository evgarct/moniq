<#
.SYNOPSIS
    Android debugging & device helper script for Moniq Wallet.
.DESCRIPTION
    Same workflow as Form's scripts/android-debug.ps1 (see Form/docs/ANDROID_DEBUGGING.md
    for the full runbook — wireless/USB pairing, screenshots, UI dumps, gotchas). Adapted
    for the Moniq Wallet app (package com.evgarct.moniqwallet).
.EXAMPLE
    .\scripts\android-debug.ps1 -Action Devices
    .\scripts\android-debug.ps1 -Action Pair -Ip 192.168.0.152 -Port 40293 -Code 143816
    .\scripts\android-debug.ps1 -Action Connect -Ip 192.168.0.152 -Port 40749
    .\scripts\android-debug.ps1 -Action BuildAndInstall
    .\scripts\android-debug.ps1 -Action Launch
    .\scripts\android-debug.ps1 -Action GrantNotificationAccess
    .\scripts\android-debug.ps1 -Action DumpNotifications
    .\scripts\android-debug.ps1 -Action Logcat
#>
param (
    [Parameter(Mandatory = $true)]
    [ValidateSet('Env', 'Devices', 'Pair', 'Connect', 'Build', 'Install', 'BuildAndInstall', 'Launch', 'Stop', 'Clear', 'Screenshot', 'DumpUi', 'GrantNotificationAccess', 'DumpNotifications', 'Logcat')]
    [string]$Action,

    [string]$Ip = "192.168.0.152",
    [int]$Port = 0,
    [string]$Code = "",
    [string]$DeviceId = "",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$PackageId = "com.evgarct.moniqwallet"
$ListenerComponent = "$PackageId/.wallet.WalletNotificationListenerService"

# 1. Environment initialization (same Scoop layout as Form's runbook)
$env:JAVA_HOME = "$HOME\scoop\apps\openjdk21\current"
$env:ANDROID_HOME = "$HOME\scoop\apps\android-clt\current"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

function Get-TargetDevice {
    if ($DeviceId) { return $DeviceId }
    $devs = & adb devices | Select-String -Pattern "(\S+)\s+device$"
    if ($devs.Count -eq 0) {
        Write-Warning "No connected Android devices found. Run -Action Connect or check USB."
        return $null
    }
    return $devs[0].Matches[0].Groups[1].Value
}

switch ($Action) {
    'Env' {
        Write-Host "Environment configured:"
        Write-Host "JAVA_HOME:    $env:JAVA_HOME"
        Write-Host "ANDROID_HOME: $env:ANDROID_HOME"
        & adb version
    }

    'Devices' {
        & adb devices -l
    }

    'Pair' {
        if (-not $Port -or -not $Code) {
            Write-Error "Usage: -Action Pair -Ip <ip> -Port <port> -Code <code>"
        }
        Write-Host "Pairing with $Ip`:$Port code $Code..."
        & adb pair "$Ip`:$Port" $Code
    }

    'Connect' {
        if (-not $Port) {
            Write-Error "Usage: -Action Connect -Ip <ip> -Port <port>"
        }
        Write-Host "Connecting to $Ip`:$Port..."
        & adb connect "$Ip`:$Port"
        & adb devices
    }

    'Build' {
        Push-Location c:\Projects\Moniq\android
        try {
            gradle assembleDebug
        } finally {
            Pop-Location
        }
    }

    'Install' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        $apk = "c:\Projects\Moniq\android\app\build\outputs\apk\debug\app-debug.apk"
        if (-not (Test-Path $apk)) {
            Write-Error "APK not found at $apk. Run -Action Build first."
        }
        Write-Host "Installing $apk to $dev..."
        & adb -s $dev install -r $apk
    }

    'BuildAndInstall' {
        Push-Location c:\Projects\Moniq\android
        try {
            gradle assembleDebug
        } finally {
            Pop-Location
        }
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        $apk = "c:\Projects\Moniq\android\app\build\outputs\apk\debug\app-debug.apk"
        Write-Host "Installing $apk to $dev..."
        & adb -s $dev install -r $apk
    }

    'Launch' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Launching $PackageId on $dev..."
        & adb -s $dev shell am start -n "$PackageId/.ui.MainActivity"
    }

    'Stop' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Stopping $PackageId on $dev..."
        & adb -s $dev shell am force-stop $PackageId
    }

    'Clear' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Clearing app data for $PackageId on $dev..."
        & adb -s $dev shell pm clear $PackageId
    }

    'Screenshot' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        if (-not $OutputPath) { $OutputPath = "screenshot_$(Get-Date -Format 'yyyyMMdd_HHmmss').png" }
        Write-Host "Capturing screenshot to $OutputPath..."
        & adb -s $dev shell screencap -p /data/local/tmp/screen.png
        & adb -s $dev pull /data/local/tmp/screen.png $OutputPath
        & adb -s $dev shell rm /data/local/tmp/screen.png
        Write-Host "Saved screenshot: $OutputPath"
    }

    'DumpUi' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        if (-not $OutputPath) { $OutputPath = "ui_dump_$(Get-Date -Format 'yyyyMMdd_HHmmss').xml" }
        Write-Host "Dumping UI hierarchy to $OutputPath..."
        & adb -s $dev shell uiautomator dump /data/local/tmp/window_dump.xml
        & adb -s $dev pull /data/local/tmp/window_dump.xml $OutputPath
        & adb -s $dev shell rm /data/local/tmp/window_dump.xml
        Write-Host "Saved UI dump: $OutputPath"
    }

    'GrantNotificationAccess' {
        # Notification-listener access isn't a normal runtime permission (no `pm grant`
        # target) — it's toggled via the NotificationManager service. `cmd notification
        # allow_listener` works from an adb shell (shell uid is allowed) on API 28+
        # without requiring the user to tap through Settings manually.
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Granting notification listener access to $ListenerComponent on $dev..."
        & adb -s $dev shell cmd notification allow_listener $ListenerComponent
    }

    'DumpNotifications' {
        # Use this while a real Google Wallet payment notification is showing on the
        # phone, to confirm the actual pkg= name for WalletNotificationListenerService.WALLET_PACKAGE.
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        & adb -s $dev shell dumpsys notification --noredact
    }

    'Logcat' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Streaming Logcat for Moniq Wallet..."
        & adb -s $dev logcat -v time -s MoniqWalletApp:* WalletNotificationListenerService:* WalletNotificationForwardWorker:* AndroidRuntime:E
    }
}
