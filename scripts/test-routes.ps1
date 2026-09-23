$body = '{"email":"byemidias_user1@byemidias.com","password":"12345678"}'
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

$routes = @(
  "/api/admin/crud/organizations?order=name&asc=true&limit=10",
  "/api/admin/crud/devices?order=name&asc=true&limit=10",
  "/api/dashboard/categories",
  "/api/auth/profile"
)
foreach ($r in $routes) {
  Write-Output ""
  Write-Output "==== $r ===="
  $r2 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app$r")
  $r2.CookieContainer = $cc
  try {
    $resp2 = $r2.GetResponse()
    $stream = $resp2.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $bodyText = $reader.ReadToEnd()
    $reader.Close()
    $preview = if ($bodyText.Length -gt 200) { $bodyText.Substring(0, 200) + "..." } else { $bodyText }
    Write-Output "  STATUS: $($resp2.StatusCode)  BODY: $preview"
  } catch {
    Write-Output "  ERRO: $($_.Exception.Message)"
    if ($_.Exception.Response) {
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $bodyText = $reader.ReadToEnd()
        $reader.Close()
        Write-Output "  STATUS: $($_.Exception.Response.StatusCode.Value__)"
        Write-Output "  BODY: $($bodyText.Substring(0, [Math]::Min(500, $bodyText.Length)))"
      } catch {}
    }
  }
}
