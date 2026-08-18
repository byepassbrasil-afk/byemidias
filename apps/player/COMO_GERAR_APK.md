# Como gerar o APK do ByeMidias Player

## O que voce precisa
- Java JDK (ja tem: C:\Program Files\Java\jdk-21)
- Android SDK (vamos instalar)

## Passo 1: Baixar Android SDK
1. Acesse: https://developer.android.com/studio#command-tools
2. Clique em "Command Line Tools Only" e baixe para Windows
3. Extraia o zip para: `C:\Users\GABRIEL\Android\Sdk\cmdline-tools\latest`
   - Deve ficar assim: `C:\Users\GABRIEL\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat`

## Passo 2: Instalar componentes do SDK
Abra PowerShell e rode:
```powershell
cd C:\Users\GABRIEL\Android\Sdk\cmdline-tools\latest\bin
.\sdkmanager.bat "platforms;android-34" "build-tools;34.0.0" "platform-tools"
```

## Passo 3: Criar local.properties
Crie o arquivo `apps/player/local.properties` com:
```
sdk.dir=C\:\\Users\\GABRIEL\\Android\\Sdk
SUPABASE_URL=https://qfotxfxzgcnbmtznlhfc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3R4Znh6Z2NuYm10em5saGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzAzMzksImV4cCI6MjEwMjQ0NjMzOX0.Gz6uMvUyHNjycELIEaggOAo-SrseaM1-2Yp_CTRa8MU
API_BASE_URL=http://localhost:3000
```

## Passo 4: Gerar o APK
```powershell
cd C:\Users\GABRIEL\Documents\ByeMidias\apps\player
.\gradlew.bat assembleDebug
```

## Passo 5: Pegar o APK
O arquivo esta em:
```
apps\player\app\build\outputs\apk\debug\app-debug.apk
```

Copie para um pen drive e instale na TV Android.

## Instalar na TV
1. Coloque o APK no pen drive
2. Na TV, use um File Manager para navegar ate o pen drive
3. Clique no APK para instalar
4. Talvez precise ativar "Fontes desconhecidas" nas configuracoes
