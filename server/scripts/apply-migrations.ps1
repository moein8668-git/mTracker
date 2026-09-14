param(
  [Parameter(Mandatory = $false)]
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw 'Provide -DatabaseUrl or set DATABASE_URL for this PowerShell session.'
}

$env:DATABASE_URL = $DatabaseUrl
try {
  npm.cmd run migrate
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
