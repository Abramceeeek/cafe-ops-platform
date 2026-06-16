# iOS App — Setup Guide

The two Flutter apps already compile for iOS (CI proves it, unsigned, on a free
macOS runner). To **install on iPhones/iPads and send push**, Apple needs a paid
account + signing. This is the step-by-step.

**Your account, your apps — even when building on someone else's Mac.** The Apple
Developer membership is tied to *your* Apple ID, not the machine. You can do the
first build on a borrowed Mac, **take your signing keys with you** (Step 7), and
afterwards build everything from the cloud (CI) with no Mac at all.

Bundle IDs: **`com.hubsync.hub`** and **`com.hubsync.shop`**.

> ⚠️ **These are Flutter apps — do NOT add the Firebase SDK manually in Xcode.**
> The `firebase_core` + `firebase_messaging` plugins already pull the Firebase iOS
> SDK in automatically. The only thing you take from Firebase's iOS wizard is the
> `GoogleService-Info.plist` (already done — see Step 4). Adding the SDK by hand
> (Swift Package Manager / CocoaPods) causes duplicate-symbol conflicts.

---

## Progress so far
- ✅ **Apple Developer Program** active (your Apple ID).
- ✅ **APNs key** created — **Key ID `4RBSSD2227`** (`.p8` kept by owner; NOT in repo).
- ✅ **Firebase iOS apps** registered for both bundle IDs.
- ✅ **`GoogleService-Info` plists committed** to `firebase/GoogleService-Info-{hub,shop}.plist`
  and auto-copied into `ios/Runner/` by `build-ios.yml` (mirrors the Android `google-services.json`).
- ✅ **Team ID** = `6HMKG4FFPY` (Abdurakhmonbek Fayzullaev).
- ✅ **APNs key uploaded to Firebase** Cloud Messaging (both apps, dev + prod) — push is wired server-side.
- ⬜ First build on a Mac (Path A) · ⬜ TestFlight testers (Step 8).

`TEAM_ID = 6HMKG4FFPY`

## STEP 1 — App IDs with Push capability · YOU ✅/verify
developer.apple.com → **Certificates, Identifiers & Profiles → Identifiers**. For
**`com.hubsync.hub`** and **`com.hubsync.shop`**, ensure each exists with
**Push Notifications** capability ticked. (Registering the Firebase iOS app usually
creates these; just confirm Push is on.)

## STEP 2 — APNs key · YOU ✅
Done — Key ID **`4RBSSD2227`**, `.p8` saved by owner. (One key covers both apps.)

## STEP 3 — Upload the APNs key to Firebase · DONE ✅
Uploaded the `.p8` (Key ID `4RBSSD2227`, Team ID `6HMKG4FFPY`) to Cloud Messaging
for both apps (dev + prod slots). This is what lets push reach iPhones.

## STEP 4 — Firebase iOS configs · DONE ✅
Both plists are committed under `firebase/`. Nothing else to download.

---

## TWO WAYS TO BUILD — pick one

### PATH A — Friend's Mac, first build (simplest to start) · MAC, ~1–2 hrs
Have **Xcode** installed beforehand (Mac App Store, ~10–15 GB).

1. Copy the project to the Mac (clone the repo or copy the folder).
2. In **each** app folder run: `flutter create --platforms=ios --org com.hubsync .` then `flutter pub get`.
3. Open `ios/Runner.xcworkspace` in **Xcode**.
4. **Add the Firebase config to the app:** drag `firebase/GoogleService-Info-<hub|shop>.plist`
   into the **Runner** group → in the dialog tick **Copy items if needed** and the **Runner target**,
   and rename it to **`GoogleService-Info.plist`**. *(This target-membership step is the one
   thing the CI can't do for you yet — it must be in the bundle for Firebase to start.)*
5. **Xcode → Settings → Accounts → +** → sign in with **your** Apple ID. Select the **Runner**
   target → **Signing & Capabilities** → tick **Automatically manage signing** → choose your **Team**.
6. Add the **Push Notifications** capability (Signing & Capabilities → + Capability).
7. **Product → Archive → Distribute App → App Store Connect → Upload.** Repeat for the second app.

### PATH B — Cloud CI, no Mac (after you have the keys from Step 7) · ME
Once you've added the GitHub secrets below, I extend `build-ios.yml` to sign with the
App Store Connect API key and upload to TestFlight automatically — every push builds a
new TestFlight build, no Mac required.
GitHub → **Settings → Secrets and variables → Actions**:
- `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_PRIVATE_KEY` (the `.p8` from Step 7b)
- `IOS_TEAM_ID`, and the distribution cert `.p12` as `IOS_DIST_CERT_P12` (base64) + its password.

---

## STEP 7 — 🔑 Take your keys so you NEVER need that Mac again · MAC, before you leave
The anti-lock-in step everyone forgets:

**7a. Export your signing certificate (with its private key):**
Keychain Access → **My Certificates** → find **"Apple Distribution: <your name>"** →
right-click → **Export** → save as **`.p12`** with a password. *(Must include the private
key — that's the part you can't regenerate later.)*

**7b. App Store Connect API key (for cloud uploads):**
appstoreconnect.apple.com → **Users and Access → Integrations → App Store Connect API → +** →
Access **App Manager** → **Generate** → download the **`.p8`** (once only). Note its **Key ID** + **Issuer ID**.

**7c.** Store the `.p12` + `.p8` in a password manager. Then **sign out of Xcode** / remove your
Apple ID from the friend's Mac. Everything else (App IDs, app records, TestFlight) lives in
*your* App Store Connect — fully portable.

## STEP 8 — Install on your ~20 phones (TestFlight) · YOU
1. appstoreconnect.apple.com → your app → **TestFlight → Internal Testing** → add staff by email
   (up to 100, **no Apple review**, instant).
2. They install the free **TestFlight** app, accept the invite, install HubSync.
3. On first launch, tap **Allow** for notifications.
> TestFlight builds expire after **90 days** — re-run the build to refresh. No public App Store listing needed.

---

## Notes
- **Secrets:** the APNs `.p8`, the `.p12`, and the App Store Connect `.p8` are **secrets** —
  keep them in a password manager, never commit them. (The committed `GoogleService-Info` /
  `google-services.json` are *client* configs — embedded in every app binary, safe to commit,
  same as the Android one. Harden by adding API-key restrictions in Google Cloud console.)
- **Cost & time:** £99/year (Apple) only. ~1–2 hrs of Mac time for the first build, then cloud.
- **Already done:** both apps compile for iOS (`build-ios` CI); adaptive landscape layout suits iPad;
  push code is cross-platform — iOS just needed the APNs key wired (Step 3).
