$body = '{"email":"byemidias_user1@byemidias.com","password":"12345678"}'
$cookieJar = "C:\Users\GABRIEL\AppData\Local\Temp\cookies.txt"
if (Test-Path $cookieJar) { Remove-Item $cookieJar }

try {
  $req = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/auth/login")
  $req.Method = "POST"
  $req.ContentType = "application/json"
  $req.CookieContainer = New-Object System.Net.CookieContainer
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $req.ContentLength = $bytes.Length
  $reqStream = $req.GetRequestStream()
  $reqStream.Write($bytes, 0, $bytes.Length)
  $reqStream.Close()
  $resp = $req.GetResponse()
  Write-Output "LOGIN STATUS: $($resp.StatusCode)"
  Write-Output "LOGIN COOKIES: $($resp.Cookies.Count)"
  foreach ($c in $resp.Cookies.GetEnumerator()) {
    Write-Output "  $($c.Name) = $($c.Value.Substring(0, [Math]::Min(50, $c.Value.Length)))..."
  }
  Write-Output "LOGIN BODY: $($resp.GetResponseStream() | %{ (New-Object System.IO.StreamReader($_)).ReadToEnd() })"
  $req.CookieContainer.GetCookies($req.RequestUri) | %{ $_.Expires = [DateTime]::Now.AddMinutes(10); $_.Path = '/' }
  $resp.Cookies | %{ $req.CookieContainer.Add($_.Clone()) }
} catch {
  Write-Output "ERRO LOGIN: $($_.Exception.Message)"
}

# Agora testa dashboard com cookie
Write-Output ""
Write-Output "===== DASHBOARD TEST ====="
try {
  $req2 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/dashboard")
  $req2.Method = "GET"
  $req2.CookieContainer = New-Object System.Net.CookieContainer
  foreach ($c in $resp.Cookies) {
    $cc = New-Object System.Net.Cookie($c.Name, $c.Value, "/", $c.Domain)
    $cc.Secure = $c.Secure
    $cc.Expires = [DateTime]::Now.AddMinutes(10)
    $req2.CookieContainer.Add($cc)
  }
  $resp2 = $req2.GetResponse()
  Write-Output "DASHBOARD STATUS: $($resp2.StatusCode)"
  Write-Output "DASHBOARD URL: $($resp2.ResponseUri)"
  $s = $resp2.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($s)
  $body = $reader.ReadToEnd()
  Write-Output "DASHBOARD BODY (first 500): $($body.Substring(0, [Math]::Min(500, $body.Length)))"
  $reader.Close()
} catch {
  Write-Output "ERRO DASHBOARD: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    Write-Output "  StatusCode: $($_.Exception.Response.StatusCode.Value__)"
    Write-Output "  Location: $($_.Exception.Response.Headers['Location'])"
  }
}
