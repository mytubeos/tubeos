# Vezrin Android wrapper

PWABuilder Trusted Web Activity source for `com.vezrin.app`, launching `https://vezrin.com/`. The app uses the installed TWA browser, so browser-controlled UI and cold-start behavior vary by provider.

## Changes and current limits

- Android Browser Helper is pinned to stable 2.7.3, which includes splash edge-to-edge support and launcher lifecycle improvements absent from the uploaded 2.6.2 project.
- Keep Android 6.0 (API 23) compatibility, as in the previous APK. Target/compile API 36.
- Restore Maven Central instead of retired JCenter.
- The uploaded project reset versionCode to 1. Default to 3; override with a number greater than EVERY uploaded Play Console version.
- Preserve the configured splash image, colors, notification delegation and browser selection.

The brief native address-bar flash shown in the Brave video is **not confirmed fixed**. No emulator or device launch test has been performed. Website Digital Asset Links already includes the Play app-signing certificate; do not replace that file with the new PWABuilder package's assetlinks.json.

## Build

Use JDK 17 and Android SDK 36:

```sh
cd android
./gradlew :app:assembleDebug :app:bundleRelease lintRelease
```

The GitHub Android workflow builds an installable debug APK and an **unsigned** release AAB. Neither is a signed Play update. Debug uses a different certificate and is not a reliable fullscreen TWA verification test.

Release version override:

```sh
./gradlew :app:bundleRelease -PreleaseVersionCode=3 -PreleaseVersionName=1.0.1
```

Sign the release AAB locally with the **existing Play upload key**. The latest source download generated a different key: do not use it for the existing Play listing without a deliberate upload-key reset. Signing keys and passwords must stay outside this repository. The certificate used by Play installs differs from the upload certificate.

## Required device checks before production

Use a Play internal-testing install signed by Play, then compare Chrome and Brave as default browsers: first launch, repeated launch, browser force-stop, offline launch, login, Google OAuth, file selection/upload, external Dodo checkout and return, Back navigation, notification permission and notification taps. Record provider/version, Android version and any toolbar flash.

If the flash persists, provider-level startup logs and verification callbacks are needed before choosing a browser-specific workaround or changing the wrapper architecture. Increasing splash fade duration does not establish domain trust or guarantee that browser UI disappears.
