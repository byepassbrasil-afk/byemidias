$body = @{
  email = "byemidias_user1@byemidias.com"
  password = "12345678"
  full_name = "Byemidias Test User"
  company_name = "Byemidias Test Company"
  company_slug = "byemidias-test"
} | ConvertTo-Json
try {
  $response = Invoke-WebRequest -Uri "https://byemidias.vercel.app/api/auth/signup" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
  Write-Output "STATUS: $($response.StatusCode)"
  Write-Output "BODY: $($response.Content)"
} catch {
  Write-Output "STATUS: $($_.Exception.Response.StatusCode.Value__)"
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  Write-Output "BODY: $($reader.ReadToEnd())"
  $reader.Close()
}
