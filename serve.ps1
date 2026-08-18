# Winziger statischer Webserver fuer lokales Testen und fuers Handy im WLAN.
# Aufruf:  powershell -ExecutionPolicy Bypass -File serve.ps1
param([int]$Port = 8080, [string]$Root = $null)

if (-not $Root) {
    # Funktioniert, egal ob das Skript neben index.html liegt oder daneben im Elternordner.
    $Root = if (Test-Path (Join-Path $PSScriptRoot 'index.html')) { $PSScriptRoot }
            else { Join-Path $PSScriptRoot 'pump-tracker' }
}
$Root = (Resolve-Path $Root).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")
try {
    $listener.Start()
} catch {
    # Ohne Adminrechte klappt "+" nicht -> nur localhost
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Port/")
    $listener.Start()
}

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
}

Write-Host "Pump Tracker laeuft auf http://localhost:$Port/  (Strg+C zum Beenden)"
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
foreach ($ip in $ips) { Write-Host "  im WLAN:  http://$($ip.IPAddress):$Port/" }

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
    $file = Join-Path $Root $path

    if (Test-Path $file -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $ctx.Response.Headers.Add('Cache-Control', 'no-store')
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404: $path")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
}
