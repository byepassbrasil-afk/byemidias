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

# Test POST
Write-Output "=== POST /api/admin/crud/campaigns ==="
$body2 = '{"name":"Test Campaign","status":"draft","organization_id":"401cd8349743e5d"}'
$req2 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/admin/crud/campaigns")
$req2.Method = "POST"
$req2.ContentType = "application/json"
$req2.CookieContainer = $cc
$bytes2 = [System.Text.Encoding]::UTF8.GetBytes($body2)
$req2.ContentLength = $bytes2.Length
$reqStream2 = $req2.GetRequestStream()
$reqStream2.Write($bytes2, 0, $bytes2.Length)
$reqStream2.Close()
try {
  $resp2 = $req2.GetResponse()
  $stream = $resp2.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $bodyText = $reader.ReadToEnd()
  $reader.Close()
  Write-Output "STATUS: $($resp2.StatusCode)"
  Write-Output "BODY: $bodyText"
} catch {
  Write-Output "STATUS: $($_.Exception.Response.StatusCode.Value__)"
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $bodyText = $reader.ReadToEnd()
  $reader.Close()
  Write-Output "BODY: $bodyText"
}

# Test direct (sem rewrite)
Write-Output ""
Write-Output "=== POST /api/pb/crud?table=campaigns ==="
$req3 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/pb/crud?table=campaigns")
$req3.Method = "POST"
$req3.ContentType = "application/json"
$req3.CookieContainer = $cc
$bytes3 = [System.Text.Encoding]::UTF8.GetBytes($body2)
$req3.ContentLength = $bytes3.Length
$reqStream3 = $req3.GetRequestStream()
$reqStream3.Write($bytes3, 0, $bytes3.Length)
$reqStream3.Close()
try {
  $resp3 = $req3.GetResponse()
  $stream = $resp3.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $bodyText = $reader.ReadToEnd()
  $reader.Close()
  Write-Output "STATUS: $($resp3.StatusCode)"
  Write-Output "BODY: $bodyText"
} catch {
  Write-Output "STATUS: $($_.Exception.Response.StatusCode.Value__)"
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object New-Object System.IO.StreamReader($stream)
  $bodyText = $reader.ReadToEnd()
  $reader.Close()
  Write-Output "BODY: $bodyText"
}
