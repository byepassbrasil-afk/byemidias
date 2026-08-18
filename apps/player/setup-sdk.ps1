# Script para configurar Android SDK e gerar APK
# Execute como Administrador

Write-Host "=== Configurando Android SDK ===" -ForegroundColor Cyan

# Criar diretorio do SDK
$sdkDir = "C:\Users\GABRIEL\Android\Sdk"
New-Item -ItemType Directory -Force -Path $sdkDir | Out-Null

# Verificar se cmdline-tools ja existe
$cmdlineToolsDir = "$sdkDir\cmdline-tools\latest"
if (Test-Path $cmdlineToolsDir) {
    Write-Host "cmdline-tools ja instalado" -ForegroundColor Green
} else {
    Write-Host "Baixando Android Command Line Tools..." -ForegroundColor Yellow
    Write-Host "Acesse: https://developer.android.com/studio#command-tools" -ForegroundColor Yellow
    Write-Host "Baixe e extraia para: $cmdlineToolsDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pressione Enter quando extrair o cmdline-tools..." -ForegroundColor Yellow
    Read-Host
}

# Configurar variaveis de ambiente
Write-Host "Configurando variaveis de ambiente..." -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkDir, "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-21", "User")

# Adicionar ao PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$newPaths = @(
    "$cmdlineToolsDir\bin",
    "$sdkDir\platform-tools"
)
foreach ($p in $newPaths) {
    if ($currentPath -notlike "*$p*") {
        $currentPath = "$p;$currentPath"
    }
}
[Environment]::SetEnvironmentVariable("Path", $currentPath, "User")

Write-Host "Variaveis configuradas!" -ForegroundColor Green
Write-Host ""
Write-Host "PROXIMO PASSO:" -ForegroundColor Cyan
Write-Host "1. Feche e abra um novo PowerShell" -ForegroundColor White
Write-Host "2. Rode: sdkmanager.bat `"platforms;android-34`" `"build-tools;34.0.0`" `"platform-tools`"" -ForegroundColor White
Write-Host "3. Depois rode o script: .\build-apk.ps1" -ForegroundColor White
