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
$stream = $resp.GetResponseStream()
$reader = New-Object System.IO.StreamReader($stream)
$bodyText = $reader.ReadToEnd()
$reader.Close()
Write-Output "LOGIN STATUS: $($resp.StatusCode)"
Write-Output "BODY: $bodyText"

# Testa profile
$req2 = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/auth/profile")
$req2.CookieContainer = $cc
$resp2 = $req2.GetResponse()
$stream2 = $resp2.GetResponseStream()
$reader2 = New-Object System.IO.StreamReader($stream2)
$body2 = $reader2.ReadToEnd()
$reader2.Close()
Write-Output ""
Write-Output "PROFILE STATUS: $($resp2.StatusCode)"
Write-Output "BODY: $body2"
