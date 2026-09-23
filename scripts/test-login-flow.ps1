$body = '{"email":"byemidias_user1@byemidias.com","password":"12345678"}'
$cc = New-Object System.Net.CookieContainer
try {
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
  Write-Output "LOGIN STATUS: $($resp.StatusCode)"
} catch {
  Write-Output "ERRO LOGIN: $($_.Exception.Message)"
  exit 1
}

$cookies = $cc.GetCookies([Uri]"https://byemidias.vercel.app/")
Write-Output "Cookies: $($cookies.Count)"
foreach ($c in $cookies) { Write-Output "  $($c.Name)" }

$req2 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/dashboard")
$req2.CookieContainer = $cc
$req2.AllowAutoRedirect = $false
$resp2 = $req2.GetResponse()
Write-Output "DASHBOARD STATUS: $($resp2.StatusCode)"
Write-Output "DASHBOARD URL: $($resp2.ResponseUri.AbsoluteUri)"

$stream = $resp2.GetResponseStream()
$reader2 = New-Object System.IO.StreamReader($stream)
$body2 = $reader2.ReadToEnd()
$reader2.Close()

if ($body2 -match "Dashboard") {
  Write-Output "OK - body tem Dashboard (login funcionou)"
} elseif ($body2 -match "Entrar") {
  Write-Output "FAIL - voltou para login"
} else {
  Write-Output "Body length: $($body2.Length)"
}
