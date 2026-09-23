$body = '{"email":"byemidias_user1@byemidias.com","password":"12345678"}'
try {
  $req = [System.Net.HttpWebRequest]::Create("https://byemidias.vercel.app/api/auth/login")
  $req.Method = "POST"
  $req.ContentType = "application/json"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $req.ContentLength = $bytes.Length
  $reqStream = $req.GetRequestStream()
  $reqStream.Write($bytes, 0, $bytes.Length)
  $reqStream.Close()
  $resp = $req.GetResponse()
  Write-Output "STATUS: $($resp.StatusCode)"
  Write-Output "SET-COOKIE: $($resp.Headers['Set-Cookie'])"
  Write-Output "BODY:"
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  Write-Output $reader.ReadToEnd()
  $reader.Close()
} catch {
  Write-Output "STATUS: $($_.Exception.Response.StatusCode.Value__)"
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  Write-Output $reader.ReadToEnd()
  $reader.Close()
}
