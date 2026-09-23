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

Write-Output ""
Write-Output "===== /api/auth/profile ====="
$req2 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/auth/profile")
$req2.CookieContainer = $cc
$resp2 = $req2.GetResponse()
$stream = $resp2.GetResponseStream()
$reader = New-Object System.IO.StreamReader($stream)
$body2 = $reader.ReadToEnd()
$reader.Close()
Write-Output "STATUS: $($resp2.StatusCode)"
Write-Output "BODY: $($body2.Substring(0, [Math]::Min(500, $body2.Length)))"

Write-Output ""
Write-Output "===== /api/dashboard/categories ====="
$req3 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/dashboard/categories")
$req3.CookieContainer = $cc
$resp3 = $req3.GetResponse()
$stream3 = $resp3.GetResponseStream()
$reader3 = New-Object System.IO.StreamReader($stream3)
$body3 = $reader3.ReadToEnd()
$reader3.Close()
Write-Output "STATUS: $($resp3.StatusCode)"
Write-Output "BODY: $($body3.Substring(0, [Math]::Min(500, $body3.Length)))"

Write-Output ""
Write-Output "===== /api/admin/crud/organizations ====="
$req4 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/admin/crud/organizations?order=name&asc=true&limit=10")
$req4.CookieContainer = $cc
$resp4 = $req4.GetResponse()
$stream4 = $resp4.GetResponseStream()
$reader4 = New-Object System.IO.StreamReader($stream4)
$body4 = $reader4.ReadToEnd()
$reader4.Close()
Write-Output "STATUS: $($resp4.StatusCode)"
Write-Output "BODY: $($body4.Substring(0, [Math]::Min(500, $body4.Length)))"
