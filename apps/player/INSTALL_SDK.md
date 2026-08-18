# Instalação do Android SDK (sem Android Studio)

## Passo 1: Baixar Command Line Tools
1. Acesse: https://developer.android.com/studio#command-tools
2. Baixe "Command Line Tools Only" para Windows
3. Extraia para: C:\Users\GABRIEL\Android\Sdk\cmdline-tools\latest

## Passo 2: Configurar variáveis de ambiente
Abra PowerShell como Admin e rode:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\GABRIEL\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-21", "User")
```

Depois feche e abra um novo terminal.

## Passo 3: Instalar SDK
```powershell
cd C:\Users\GABRIEL\Android\Sdk\cmdline-tools\latest\bin
.\sdkmanager.bat "platforms;android-34" "build-tools;34.0.0" "platform-tools"
```

## Passo 4: Gerar Keystore
```powershell
cd C:\Users\GABRIEL\Documents\ByeMidias\apps\player
keytool -genkey -v -keystore byemidias-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias byemidias
```
(Senha: use qualquer uma, ex: byemidias123)

## Passo 5: Criar local.properties
Crie o arquivo `apps/player/local.properties`:
```properties
sdk.dir=C\:\\Users\\GABRIEL\\Android\\Sdk
SUPABASE_URL=https://qfotxfxzgcnbmtznlhfc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3R4Znh6Z2NuYm10em5saGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzAzMzksImV4cCI6MjEwMjQ0NjMzOX0.Gz6uMvUyHNjycELIEaggOAo-SrseaM1-2Yp_CTRa8MU
API_BASE_URL=http://localhost:3000
RELEASE_STORE_FILE=../byemidias-release.jks
RELEASE_STORE_PASSWORD=byemidias123
RELEASE_KEY_ALIAS=byemidias
RELEASE_KEY_PASSWORD=byemidias123
```

## Passo 6: Build do APK
```powershell
cd C:\Users\GABRIEL\Documents\ByeMidias\apps\player
.\gradlew.bat assembleRelease
```

## Passo 7: Pegar o APK
O APK estará em:
```
apps\player\app\build\outputs\apk\release\app-release.apk
```

Copie para um pen drive e instale na TV.
