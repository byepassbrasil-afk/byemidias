$body = '{"email":"byemidias@gmail.com","password":"byemidias12345"}'
$cc = New-Object System.Net.CookieContainer
$req = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/auth/login")
$req.Method = "POST"
$req.ContentType = "application/json"
$req.CookieContainer = $cc
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$req.ContentLength = $bytes.Length
$reqStream = $req.GetRequestStream()
$reqStream.Write($bytes, 0, $bytes.Length)
$reqStream.Close()
$resp = $req.GetResponse()
Write-Output "LOGIN: $($resp.StatusCode)"

# Testar rotas que quebram - especialmente POST/PUT que precisam de INSERT/UPDATE
$endpoints = @(
  @{method = "GET";  path = "/api/admin/crud/organizations?order=name&asc=true" },
  @{method = "GET";  path = "/api/admin/crud/devices?order=name&asc=true&limit=10" },
  @{method = "GET";  path = "/api/admin/crud/media?order=created_at&asc=false&limit=10&status=active" },
  @{method = "GET";  path = "/api/admin/crud/playlists?order=name&asc=true" },
  @{method = "GET";  path = "/api/admin/crud/campaigns?order=name&asc=true" },
  @{method = "GET";  path = "/api/admin/crud/categories" },
  @{method = "GET";  path = "/api/admin/partners?order=name&asc=true" }
)
foreach ($e in $endpoints) {
  $req2 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app$($e.path)")
  $req2.CookieContainer = $cc
  try {
    $resp2 = $req2.GetResponse()
    $stream = $resp2.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    $reader.Close()
    $preview = if ($body.Length -gt 200) { $body.Substring(0, 200) + "..." } else { $body }
    Write-Output "  [$($e.method) $($e.path)] $($resp2.StatusCode) $preview"
  } catch {
    Write-Output "  [$($e.method) $($e.path)] ERRO: $($_.Exception.Message)"
  }
}
