param(
    [switch]$Yes,
    [switch]$NonInteractive,
    [switch]$Launch,
    [switch]$SkipCredentials,
    [switch]$InstallService,
    [switch]$NoService,
    [string]$Exchange = $env:SIGNAL_EXECUTOR_EXCHANGE,
    [string]$Profile = $env:SIGNAL_EXECUTOR_PROFILE,
    [string]$InstallDir,
    [int]$Port = $(if ($env:SIGNAL_EXECUTOR_PORT) { [int]$env:SIGNAL_EXECUTOR_PORT } else { 38182 })
)

$ErrorActionPreference = "Stop"

$downloadDir = Join-Path $env:TEMP "SignalHorsePortable"
$archivePath = Join-Path $downloadDir "signal_horse_windows_portable.zip"
$extractPath = Join-Path $downloadDir "extract"
$releaseManifestUrl = if ([string]::IsNullOrWhiteSpace($env:SIGNAL_HORSE_MANIFEST_URL)) {
    "https://signal.horse/api/releases/latest"
} else {
    $env:SIGNAL_HORSE_MANIFEST_URL
}
$legacyDownloadUrl = if ([string]::IsNullOrWhiteSpace($env:SIGNAL_HORSE_WINDOWS_DOWNLOAD_URL)) {
    "https://signal.horse/releases/latest/signal-horse-windows-portable.zip"
} else {
    $env:SIGNAL_HORSE_WINDOWS_DOWNLOAD_URL
}
$resolvedInstallDir = if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    Join-Path $env:LOCALAPPDATA "SignalExecutor"
} else {
    [System.IO.Path]::GetFullPath($InstallDir)
}
$launcherPath = Join-Path $resolvedInstallDir "Start Signal Executor.cmd"
$script:ReleaseManifest = $null

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Signal Horse - Local Mode Installer                ║" -ForegroundColor Cyan
Write-Host "║      Portable Windows package bootstrap helper            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

function Confirm-Installation {
    if ($Yes -or $NonInteractive) {
        return
    }

    $confirm = Read-Host "Proceed with installation? [Y/n]"
    if ($confirm -match "^[Nn]") {
        Write-Host "Installation cancelled."
        exit 0
    }
}

function Show-CompatibilityWarning {
    $usesDeprecatedOptions =
        $SkipCredentials -or
        $InstallService -or
        $NoService -or
        (-not [string]::IsNullOrWhiteSpace($Exchange)) -or
        (-not [string]::IsNullOrWhiteSpace($Profile)) -or
        $PSBoundParameters.ContainsKey("Port")

    if ($usesDeprecatedOptions) {
        Write-Host "This helper now downloads the portable ZIP only. Credential, service, exchange/profile, and custom port options are no longer applied here." -ForegroundColor Yellow
    }

    if ($NonInteractive) {
        Write-Host "NonInteractive skips prompts and extracts the portable package directly into the target folder." -ForegroundColor Yellow
    }
}

function Get-ReleaseManifest {
    if ($null -ne $script:ReleaseManifest) {
        return $script:ReleaseManifest
    }

    try {
        $script:ReleaseManifest = Invoke-RestMethod -Uri $releaseManifestUrl -Method Get
    }
    catch {
        Write-Host "Release manifest fetch failed from $releaseManifestUrl. Falling back to legacy Windows ZIP URL." -ForegroundColor Yellow
        $script:ReleaseManifest = $false
    }

    return $script:ReleaseManifest
}

function Resolve-ArchiveDownloadUrl {
    $manifest = Get-ReleaseManifest

    if ($manifest -and $manifest.installerUrl) {
        return [string]$manifest.installerUrl
    }

    if ($manifest -and $manifest.platforms -and $manifest.platforms.windows -and $manifest.platforms.windows.installerUrl) {
        return [string]$manifest.platforms.windows.installerUrl
    }

    return $legacyDownloadUrl
}

function Download-Archive {
    if (-not (Test-Path $downloadDir)) {
        New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
    }

    if (Test-Path $archivePath) {
        Remove-Item $archivePath -Force
    }
    if (Test-Path $extractPath) {
        Remove-Item -Recurse -Force $extractPath
    }

    $downloadUrl = Resolve-ArchiveDownloadUrl
    Write-Host "Downloading Windows portable ZIP..." -ForegroundColor Blue
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
}

function Install-Archive {
    New-Item -ItemType Directory -Path $extractPath -Force | Out-Null
    New-Item -ItemType Directory -Path $resolvedInstallDir -Force | Out-Null

    Write-Host "Extracting portable package to $resolvedInstallDir ..." -ForegroundColor Green
    Expand-Archive -Path $archivePath -DestinationPath $extractPath -Force

    Get-ChildItem -Path $extractPath | ForEach-Object {
        Copy-Item $_.FullName -Destination $resolvedInstallDir -Recurse -Force
    }
}

function Launch-PortablePackage {
    if (-not $Launch) {
        return
    }

    if (-not (Test-Path $launcherPath)) {
        throw "Portable launcher not found at $launcherPath"
    }

    Write-Host "Launching Signal Horse from $launcherPath ..." -ForegroundColor Green
    Start-Process -FilePath $launcherPath | Out-Null
}

function Show-Completion {
    Write-Host ""
    Write-Host "Portable package extracted to: $resolvedInstallDir" -ForegroundColor Green
    Write-Host "Start later with: $launcherPath" -ForegroundColor Green
    Write-Host "Local UI: http://127.0.0.1:38182/" -ForegroundColor Green
}

function Main {
    Confirm-Installation
    Show-CompatibilityWarning
    Download-Archive
    Install-Archive
    Launch-PortablePackage
    Show-Completion
}

Main