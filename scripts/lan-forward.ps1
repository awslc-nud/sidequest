# SideQuest — expose the WSL2 dev server to your LAN (Windows host).
#
# WSL2 runs behind a NAT, so a phone on your Wi-Fi cannot reach the WSL IP
# directly. This script forwards  WindowsLAN:PORT -> WSL:PORT  and opens the
# firewall. Run it in an ELEVATED PowerShell (Administrator):
#
#   1. Open Start, type "PowerShell", right-click -> "Run as administrator".
#   2. powershell -ExecutionPolicy Bypass -File .\scripts\lan-forward.ps1
#
# The WSL IP changes when WSL restarts, so re-run this after a reboot.
# (Alternative: switch WSL to mirrored networking in %UserProfile%\.wslconfig
#  with `[wsl2]` / `networkingMode=mirrored`, then `wsl --shutdown`.)

param(
  [int]$Port = 4321,
  [string]$Distro = "",
  [string]$WslIp = ""
)

$ErrorActionPreference = "Stop"

# --- WSL IP -----------------------------------------------------------------
if (-not $WslIp) {
  $raw = $null
  try {
    if ($Distro -ne "") { $raw = (wsl -d $Distro hostname -I) } else { $raw = (wsl hostname -I) }
  } catch {}
  if ($raw) { $WslIp = ($raw -split '\s+')[0].Trim() }
}
if (-not $WslIp) { throw "Could not determine the WSL IP. Pass it explicitly: -WslIp 172.x.x.x" }

# --- Windows LAN IP (interface that owns the default route) ------------------
$lanIp = (Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
  ForEach-Object { $_.IPv4Address.IPAddress } |
  Select-Object -First 1)
if (-not $lanIp) {
  $lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '172.*' } |
    Select-Object -First 1).IPAddress
}
if (-not $lanIp) { throw "Could not determine the Windows LAN IP." }

Write-Host "Forwarding ${lanIp}:$Port  ->  ${wslIp}:$Port"

# --- Port proxy (idempotent) -------------------------------------------------
netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=$lanIp *> $null
netsh interface portproxy add v4tov4 listenport=$Port listenaddress=$lanIp connectport=$Port connectaddress=$wslIp
if ($LASTEXITCODE -ne 0) { throw "netsh portproxy failed. Did you run this as Administrator?" }

# --- Firewall (idempotent) ---------------------------------------------------
$ruleName = "SideQuest dev $Port"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
}

Write-Host ""
Write-Host "Ready. Open this on your phone (same Wi-Fi):"
Write-Host "   http://${lanIp}:$Port/" -ForegroundColor Green
Write-Host ""
Write-Host "Check/remove later:"
Write-Host "   netsh interface portproxy show v4tov4"
Write-Host "   netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=$lanIp"
