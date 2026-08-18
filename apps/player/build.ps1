# Build simples do APK (sem keystore)
# Execute este script

Write-Host "=== Gerando APK ===" -ForegroundColor Cyan

# Verificar se Android SDK existe
$sdkDir = "C:\Users\GABRIEL\Android\Sdk"
if (-not (Test-Path $sdkDir)) {
    Write-Host ""
    Write-Host "ERRO: Android SDK nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Primeiro execute: .\setup-simples.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Configurar ambiente
$env:ANDROID_HOME = $sdkDir
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"

# Build
Write-Host "Buildando APK..." -ForegroundColor Yellow
Set-Location "C:\Users\GABRIEL\Documents\ByeMidias\apps\player"
& .\gradlew.bat assembleDebug

if (Test-Path "app\build\outputs\apk\debug\app-debug.apk") {
    Write-Host ""
    Write-Host "APK GERADO!" -ForegroundColor Green
    Write-Host "app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
    
    # Copiar para Desktop
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "$([Environment]::GetFolderPath('Desktop'))\ByeMidias-Player.apk" -Force
    Write-Host "Copiado para: Desktop\ByeMidias-Player.apk" -ForegroundColor Green
} else {
    Write-Host "Erro ao gerar APK" -ForegroundColor Red
}
