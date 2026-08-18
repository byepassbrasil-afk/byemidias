# ByeMidias Player - Build Instructions

## Prerequisites
- Android Studio (latest stable)
- Android SDK 34
- JDK 17

## Setup

1. Open `apps/player/` in Android Studio
2. Sync Gradle
3. Set environment variables or create `local.properties`:

```properties
# apps/player/local.properties
sdk.dir=C\:\\Users\\GABRIEL\\AppData\\Local\\Android\\Sdk
SUPABASE_URL=https://qfotxfxzgcnbmtznlhfc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
API_BASE_URL=http://YOUR_SERVER_IP:3000
```

## Build Debug APK
```bash
cd apps/player
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

## Build Release APK
```bash
# 1. Generate keystore (first time only)
keytool -genkey -v -keystore byemidias-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias byemidias

# 2. Add to local.properties
RELEASE_STORE_FILE=../byemidias-release.jks
RELEASE_STORE_PASSWORD=your_password
RELEASE_KEY_ALIAS=byemidias
RELEASE_KEY_PASSWORD=your_password

# 3. Build
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

## Install on Android TV
```bash
adb install app-release.apk
```

## Device Activation Flow
1. Install APK on Android TV
2. App shows activation screen with Device ID
3. Admin generates activation code in CMS (🔑 Códigos de Ativação)
4. User enters code in app
5. Device is activated and starts playing content
