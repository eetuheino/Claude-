param([int]$Port = 5173, [string]$Root = (Join-Path $PSScriptRoot '..\vaalo'))
$Root = (Resolve-Path $Root).Path
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.png'='image/png'; '.svg'='image/svg+xml'; '.json'='application/json'; '.woff2'='font/woff2'; '.ico'='image/x-icon'; '.jpg'='image/jpeg'; '.xml'='application/xml'; '.txt'='text/plain; charset=utf-8'; '.webmanifest'='application/manifest+json' }
$l = [System.Net.HttpListener]::new()
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $Root on http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ($path -eq '') { $path = 'index.html' }
  $file = [IO.Path]::GetFullPath((Join-Path $Root $path))
  if ($file.StartsWith($Root) -and (Test-Path $file -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
    $nf = Join-Path $Root '404.html'
    if (Test-Path $nf) { $b = [IO.File]::ReadAllBytes($nf); $ctx.Response.ContentType = 'text/html; charset=utf-8'; $ctx.Response.OutputStream.Write($b, 0, $b.Length) }
  }
  $ctx.Response.Close()
  Write-Host "$($ctx.Request.HttpMethod) /$path $($ctx.Response.StatusCode)"
}
