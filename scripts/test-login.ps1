$body = @{
  email = "byemidias_user1@byemidias.com"
  password = "12345678"
} | ConvertTo-Json
try {
  $response = Invoke-WebRequest -Uri "https://byemidias.vercel.app/api/auth/login" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
  Write-Output "STATUS: $($response.StatusCode)"
  Write-Output "BODY: $($response.Content)"
  Write-Output "COOKIES: $($response.Headers.GetValues('Set-Cookie'))"
} catch {
  Write-Output "STATUS: $($_.Exception.Response.StatusCode.Value__)"
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  Write-Output "BODY: $($reader.ReadToEnd())"
  $reader.Close()
}
