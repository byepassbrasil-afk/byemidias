# Script para gerar o APK
# Execute depois de configurar o SDK

$ErrorActionPreference = "Stop"

Write-Host "=== Gerando APK do ByeMidias Player ===" -ForegroundColor Cyan

# Verificar JAVA_HOME
if (-not $env:JAVA_HOME) {
    $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
}
Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Gray

# Verificar se o keystore existe
$keystorePath = "C:\Users\GABRIEL\Documents\ByeMidias\apps\player\byemidias-release.jks"
if (-not (Test-Path $keystorePath)) {
    Write-Host "Gerando keystore..." -ForegroundColor Yellow
    Push-Location "C:\Users\GABRIEL\Documents\ByeMidias\apps\player"
    
    $password = "byemidias123"
    $keytoolArgs = @(
        "-genkey", "-v",
        "-keystore", "byemidias-release.jks",
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "10000",
        "-alias", "byemidias",
        "-storepass", $password,
        "-keypass", $password,
        "-dname", `"CN=ByeMidias, OU=Dev, O=ByeMidias, L=Sao Paulo, ST=SP, C=BR`""
    )
    
    & "C:\Program Files\Java\jdk-21\bin\keytool.exe" $keytoolArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro ao gerar keystore!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Pop-Location
    Write-Host "Keystore gerado!" -ForegroundColor Green
}

# Verificar se o local.properties existe
$localProps = "C:\Users\GABRIEL\Documents\ByeMidias\apps\player\local.properties"
if (-not (Test-Path $localProps)) {
    Write-Host "Criando local.properties..." -ForegroundColor Yellow
    
    $propsContent = @"
sdk.dir=C\:\\Users\\GABRIEL\\Android\\Sdk
SUPABASE_URL=https://qfotxfxzgcnbmtznlhfc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3R4Znh6Z2NuYm10em5saGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzAzMzksImV4cCI6MjEwMjQ0NjMzOX0.Gz6uMvUyHNjycELIEaggOAo-SrseaM1-2Yp_CTRa8MU
API_BASE_URL=http://localhost:3000
RELEASE_STORE_FILE=../byemidias-release.jks
RELEASE_STORE_PASSWORD=byemidias123
RELEASE_KEY_ALIAS=byemidias
RELEASE_KEY_PASSWORD=byemidias123
"@
    
    Set-Content -Path $localProps -Value $propsContent
    Write-Host "local.properties criado!" -ForegroundColor Green
}

# Build do APK
Write-Host "Gerando APK..." -ForegroundColor Yellow
Push-Location "C:\Users\GABRIEL\Documents\ByeMidias\apps\player"

if (Test-Path ".\gradlew.bat") {
    & .\gradlew.bat assembleRelease
} else {
    & gradle assembleRelease
}

Pop-Location

if ($LASTEXITCODE -eq 0) {
    $apkPath = "C:\Users\GABRIEL\Documents\ByeMidias\apps\player\app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $apkPath) {
        Write-Host ""
        Write-Host "=== APK GERADO COM SUCESSO! ===" -ForegroundColor Green
        Write-Host "Localizacao: $apkPath" -ForegroundColor White
        Write-Host ""
        Write-Host "Para instalar na TV:" -ForegroundColor Cyan
        Write-Host "1. Copie o APK para um pen drive" -ForegroundColor White
        Write-Host "2. Na TV, use um file manager para instalar" -ForegroundColor White
        Write-Host "3. Ou use: adb install app-release.apk" -ForegroundColor White
        
        # Copiar para Desktop
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        Copy-Item $apkPath "$desktopPath\ByeMidias-Player-v1.0.0.apk" -Force
        Write-Host ""
        Write-Host "APK copiado para: $desktopPath\ByeMidias-Player-v1.0.0.apk" -ForegroundColor Green
    } else {
        Write-Host "APK nao encontrado em: $apkPath" -ForegroundColor Red
    }
} else {
    Write-Host "Erro ao gerar APK!" -ForegroundColor Red
}
