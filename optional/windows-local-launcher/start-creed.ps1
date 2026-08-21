param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8000,

  [string]$ProtocolUrl = "",

  [switch]$Unregister
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = [System.IO.Path]::GetFullPath($MyInvocation.MyCommand.Path)
$launcherDirectory = Split-Path -Parent $scriptPath
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $launcherDirectory "..\.."))
$indexPath = Join-Path $repositoryRoot "index.html"
$url = "http://localhost:$Port/"
$protocolRoot = "Registry::HKEY_CURRENT_USER\Software\Classes\creed"

function Register-CreedProtocol {
  $commandKey = Join-Path $protocolRoot "shell\open\command"
  $powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
  $command = '"{0}" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "{1}" -ProtocolUrl "%1"' -f $powerShellPath, $scriptPath

  New-Item -Path $protocolRoot -Force | Out-Null
  Set-Item -Path $protocolRoot -Value "URL:CREED Local Launcher"
  New-ItemProperty -Path $protocolRoot -Name "URL Protocol" -PropertyType String -Value "" -Force | Out-Null
  New-Item -Path $commandKey -Force | Out-Null
  Set-Item -Path $commandKey -Value $command
}

function Unregister-CreedProtocol {
  if (Test-Path -LiteralPath $protocolRoot) {
    Remove-Item -LiteralPath $protocolRoot -Recurse -Force
    Write-Host "Removed the creed:// launcher registration for the current Windows user."
  }
  else {
    Write-Host "The creed:// launcher is not registered for the current Windows user."
  }
}

function Test-CreedEndpoint {
  param([string]$Uri)

  try {
    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
    return ($response.StatusCode -ge 200 -and $response.Content -match "<title>CREED")
  }
  catch {
    return $false
  }
}

function Test-LocalPortInUse {
  param([int]$LocalPort)

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connectTask = $client.ConnectAsync("127.0.0.1", $LocalPort)
    if (-not $connectTask.Wait(400)) {
      return $false
    }
    return $client.Connected
  }
  catch {
    return $false
  }
  finally {
    $client.Dispose()
  }
}

if ($Unregister) {
  Unregister-CreedProtocol
  exit 0
}

if ($ProtocolUrl -and -not $ProtocolUrl.StartsWith("creed://", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsupported CREED protocol URL: $ProtocolUrl"
}

if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
  throw "CREED index.html was not found at: $indexPath"
}

try {
  Register-CreedProtocol
}
catch {
  Write-Warning "CREED could not register the creed:// launcher for this Windows user. Manual launching still works. $($_.Exception.Message)"
}

if (Test-CreedEndpoint -Uri $url) {
  Write-Host "CREED is already running at $url"
  Start-Process $url
  exit 0
}

if (Test-LocalPortInUse -LocalPort $Port) {
  throw "Port $Port is already in use by another local service. Stop that service or run this script with a different -Port value."
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
  $pythonCommand = Get-Command py -ErrorAction SilentlyContinue
}

if (-not $pythonCommand) {
  throw "Python was not found. Install Python or make python/py available in PATH."
}

Set-Location -LiteralPath $repositoryRoot

Write-Host "CREED local launcher"
Write-Host "cd `"$repositoryRoot`""
Write-Host "$($pythonCommand.Name) -m http.server $Port"
Write-Host ""

$serverProcess = Start-Process `
  -FilePath $pythonCommand.Source `
  -ArgumentList "-m", "http.server", "$Port" `
  -WorkingDirectory $repositoryRoot `
  -NoNewWindow `
  -PassThru

try {
  $serverReady = $false

  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if ($serverProcess.HasExited) {
      throw "Python HTTP server exited before CREED became available. Exit code: $($serverProcess.ExitCode)"
    }

    if (Test-CreedEndpoint -Uri $url) {
      $serverReady = $true
      break
    }

    Start-Sleep -Milliseconds 250
  }

  if (-not $serverReady) {
    throw "CREED did not become available at $url."
  }

  Write-Host "CREED is running at $url"
  Write-Host "Opening the default browser..."
  Write-Host "Close this launcher window or press Ctrl+C to stop the local server."
  Start-Process $url

  Wait-Process -Id $serverProcess.Id
}
finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
