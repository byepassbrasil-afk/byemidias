$body = @{
  email = "test_pb@x.com"
  password = "12345678"
  full_name = "Test PB"
  company_name = "Test Company"
  company_slug = "test-company"
} | ConvertTo-Json
$response = Invoke-WebRequest -Uri "https://byemidias.vercel.app/api/auth/signup" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$response.Content
