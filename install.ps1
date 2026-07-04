# rtk installer for Windows - https://github.com/rtk-ai/rtk
# Usage: irm https://raw.githubusercontent.com/renatorf04/claude.code.rtk/main/install.ps1 | iex
#
# Native Windows only supports x86_64 (rtk-x86_64-pc-windows-msvc.zip).
# Set $env:RTK_VERSION to pin a version (e.g. "v0.28.2") if GitHub's API is rate-limited.

$ErrorActionPreference = "Stop"

$Repo = "rtk-ai/rtk"
$BinaryName = "rtk"
$Target = "x86_64-pc-windows-msvc"
$InstallDir = if ($env:RTK_INSTALL_DIR) { $env:RTK_INSTALL_DIR } else { Join-Path $env:USERPROFILE ".local\bin" }

function Get-LatestVersion {
    if ($env:RTK_VERSION) {
        return $env:RTK_VERSION
    }

    try {
        $response = Invoke-WebRequest -Uri "https://github.com/$Repo/releases/latest" -MaximumRedirection 0 -ErrorAction SilentlyContinue
    } catch {
        $response = $_.Exception.Response
    }

    $location = $null
    if ($response -and $response.Headers -and $response.Headers["Location"]) {
        $location = $response.Headers["Location"]
    }

    if ($location -and $location -match "/tag/([^/]+)$") {
        return $Matches[1]
    }

    Write-Warning "Redirect lookup failed, falling back to GitHub API..."
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        if ($release.tag_name) {
            return $release.tag_name
        }
    } catch {
        # fall through to error below
    }

    throw "Failed to get latest version (GitHub API may be rate-limited; set `$env:RTK_VERSION = 'vX.Y.Z'` to pin)"
}

$Version = Get-LatestVersion
Write-Host "Installing $BinaryName $Version for $Target..." -ForegroundColor Green

$AssetName = "$BinaryName-$Target.zip"
$DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$AssetName"
$ChecksumsUrl = "https://github.com/$Repo/releases/download/$Version/checksums.txt"

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir | Out-Null

try {
    $Archive = Join-Path $TempDir $AssetName
    $Checksums = Join-Path $TempDir "checksums.txt"

    Write-Host "Downloading from: $DownloadUrl"
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $Archive

    Write-Host "Downloading checksums..."
    try {
        Invoke-WebRequest -Uri $ChecksumsUrl -OutFile $Checksums
    } catch {
        throw "Failed to download checksums.txt - refusing to install unverified binary (set `$env:RTK_SKIP_CHECKSUM = '1'` to bypass at your own risk)"
    }

    if ($env:RTK_SKIP_CHECKSUM -eq "1") {
        Write-Warning "RTK_SKIP_CHECKSUM=1 set - SKIPPING checksum verification (NOT RECOMMENDED)"
    } else {
        Write-Host "Verifying SHA-256 checksum..."
        $checksumLine = Select-String -Path $Checksums -Pattern ([regex]::Escape($AssetName)) | Select-Object -First 1
        if (-not $checksumLine) {
            throw "checksum for $AssetName not found in checksums.txt - refusing to install"
        }
        $expected = ($checksumLine.Line -split '\s+')[0]
        $actual = (Get-FileHash -Path $Archive -Algorithm SHA256).Hash.ToLower()
        if ($expected.ToLower() -ne $actual) {
            throw "checksum mismatch! expected=$expected actual=$actual - refusing to install"
        }
        Write-Host "Checksum verified."
    }

    Write-Host "Extracting..."
    Expand-Archive -Path $Archive -DestinationPath $TempDir -Force

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $ExePath = Get-ChildItem -Path $TempDir -Filter "$BinaryName.exe" -Recurse | Select-Object -First 1
    if (-not $ExePath) {
        throw "$BinaryName.exe not found in downloaded archive"
    }
    Copy-Item -Path $ExePath.FullName -Destination (Join-Path $InstallDir "$BinaryName.exe") -Force

    Write-Host "Successfully installed $BinaryName to $InstallDir\$BinaryName.exe" -ForegroundColor Green
} finally {
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}

$InstalledBin = Join-Path $InstallDir "$BinaryName.exe"
$version = & $InstalledBin --version
Write-Host "Verification: $version" -ForegroundColor Green

if (($env:Path -split ";") -notcontains $InstallDir) {
    Write-Warning "$InstallDir is not on your PATH. Add it for this session with:"
    Write-Warning "  `$env:Path = `"$InstallDir;`$env:Path`""
    Write-Warning "Or add it permanently via System Properties > Environment Variables."
}

Write-Host ""
Write-Host "Installation complete! Run '$BinaryName --help' to get started." -ForegroundColor Green
