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

function Test-Post($url, $bodyStr, $label) {
  $r = [System.Net.HttpWebRequest]::Create($url)
  $r.Method = "POST"
  $r.ContentType = "application/json"
  $r.CookieContainer = $cc
  $rb = [System.Text.Encoding]::UTF8.GetBytes($bodyStr)
  $r.ContentLength = $rb.Length
  $s = $r.GetRequestStream()
  $s.Write($rb, 0, $rb.Length)
  $s.Close()
  try {
    $resp = $r.GetResponse()
    $st = $resp.GetResponseStream()
    $rdr = New-Object System.IO.StreamReader($st)
    $b = $rdr.ReadToEnd()
    $rdr.Close()
    Write-Output "[$label] STATUS: $($resp.StatusCode)"
    Write-Output "[$label] BODY: $($b.Substring(0, [Math]::Min(500, $b.Length)))"
  } catch {
    $err = $_.Exception
    Write-Output "[$label] EXCEPTION: $($err.Message)"
    if ($err.InnerException) {
      Write-Output "[$label] INNER: $($err.InnerException.Message)"
    }
    if ($err.PSObject -and $err.PSObject.Properties['Response']) {
      $resp = $err.PSObject.Properties['Response'].Value
      Write-Output "[$label] RESPONSE STATUS: $($resp.StatusCode)"
      try {
        $st = $resp.GetResponseStream()
        $rdr = New-Object System.IO.StreamReader($st)
        $b = $rdr.ReadToEnd()
        $rdr.Close()
        Write-Output "[$label] RESPONSE BODY: $($b.Substring(0, [Math]::Min(500, $b.Length)))"
      } catch {}
    }
  }
}

$body2 = '{"name":"Test Campaign","status":"draft","organization_id":"401cd8349743e5d"}'
Test-Post "https://byemidias.vercel.app/api/admin/crud/campaigns" $body2 "REWRITE"
Test-Post "https://byemidias.vercel.app/api/pb/crud?table=campaigns" $body2 "DIRECT"
