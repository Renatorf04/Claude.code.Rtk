# Claude.code.Rtk

Sets up a Claude Code `SessionStart` hook that automatically installs the
[rtk](https://github.com/rtk-ai/rtk) CLI in remote/cloud sessions
(`.claude/hooks/session-start.sh`).

## Installing rtk manually

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

### Windows · PowerShell 5.1+

`rtk-ai/rtk` doesn't ship a PowerShell installer, only pre-built `.zip`
releases for Windows. `install.ps1` in this repo downloads the matching
release asset, verifies its SHA-256 checksum against `checksums.txt`, and
installs `rtk.exe` to `%USERPROFILE%\.local\bin`:

```powershell
irm https://raw.githubusercontent.com/renatorf04/claude.code.rtk/main/install.ps1 | iex
```

Set `$env:RTK_VERSION` to pin a version if GitHub's API is rate-limited, e.g.:

```powershell
$env:RTK_VERSION = "v0.28.2"
irm https://raw.githubusercontent.com/renatorf04/claude.code.rtk/main/install.ps1 | iex
```

Note: native Windows only supports `x86_64`. For full hook support
(auto-rewrite, etc.), rtk recommends [WSL](https://learn.microsoft.com/en-us/windows/wsl/install).
