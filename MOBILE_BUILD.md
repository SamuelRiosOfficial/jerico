# JERICO — Android and PWA build

This mobile work is isolated on branch `mobile/android-pwa`. The published `main` branch and its GitHub Pages deployment are not modified by this build.

## Outputs

The GitHub Actions workflow creates:
- `JERICO-Android-Test.apk`: installable Android test package, signed with the runner's debug certificate.
- `JERICO-PWA-Web.zip`: web app bundle prepared for HTTPS hosting and browser installation.

The PWA precaches the app shell and checked-in game assets for offline local play. Online multiplayer still requires an internet connection and uses the existing Supabase project.

## Android test installation

Download the APK from the workflow's `JERICO-Android-and-PWA` artifact, transfer it to an Android phone, open it, and allow installation from that source when Android asks. This is a debug/testing build, not a Play Store release.

A new GitHub-hosted build receives a temporary debug signing key. Before installing a later APK over an earlier test build, uninstall the previous test build first. A stable private release keystore must be created and backed up before distributing production updates.

## PWA

Extract `JERICO-PWA-Web.zip` to an HTTPS static host. On Android, use the browser's Install app option. On iPhone, open the hosted page in Safari, choose Share, then Add to Home Screen. The existing production site is intentionally not changed by this branch.

## iOS native app

The Capacitor iOS platform package is included, but producing an IPA requires macOS, Xcode, and Apple signing/provisioning. The Android workflow does not attempt an iOS build.

## App identifier

The permanent Capacitor app identifier is `com.samuelriosofficial.jerico`. Keep it unchanged for future updates.
