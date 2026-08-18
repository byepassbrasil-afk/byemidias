# Setup simples - Instalar Android SDK
# Execute como Administrador

Write-Host "=== Configurando Ambiente Android ===" -ForegroundColor Cyan

# 1. Criar diretorio
$sdkDir = "C:\Users\GABRIEL\Android\Sdk"
New-Item -ItemType Directory -Force -Path $sdkDir | Out-Null

# 2. Configurar variaveis
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkDir, "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-21", "User")

# Adicionar ao PATH
$path = [Environment]::GetEnvironmentVariable("Path", "User")
$addPaths = @(
    "$sdkDir\cmdline-tools\latest\bin",
    "$sdkDir\platform-tools",
    "$sdkDir\build-tools\34.0.0"
)
foreach ($p in $addPaths) {
    if ($path -notlike "*$p*") {
        $path = "$p;$path"
    }
}
[Environment]::SetEnvironmentVariable("Path", $path, "User")

Write-Host ""
Write-Host "Variaveis configuradas!" -ForegroundColor Green
Write-Host ""
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Baixe o Android Command Line Tools:" -ForegroundColor White
Write-Host "   https://developer.android.com/studio#command-tools" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Extraia para: $sdkDir\cmdline-tools\latest" -ForegroundColor White
Write-Host "   (a pasta 'bin' deve ficar em: $sdkDir\cmdline-tools\latest\bin)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Abra um NOVO PowerShell e rode:" -ForegroundColor White
Write-Host "   sdkmanager.bat `"platforms;android-34`" `"build-tools;34.0.0`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Depois rode: .\build.ps1" -ForegroundColor White
Write-Host ""
