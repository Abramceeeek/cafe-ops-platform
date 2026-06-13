# iOS App — Setup Guide

The Flutter apps already build for iOS (CI proves it, unsigned, on a free macOS
runner). To actually **install on iPhones/iPads and send push**, Apple requires a
paid account + signing. This is the step-by-step.

**Division of work:** _You_ do the Apple/Firebase portal clicks (no Mac needed).
_I_ wire the CI to sign the app and upload it to TestFlight. Bundle IDs are
**`com.hubsync.shop`** and **`com.hubsync.hub`**.

---

## STEP 1 — Apple Developer account ($99/year) · YOU
1. Go to **developer.apple.com** → **Account** → enroll in the **Apple Developer Program**.
2. Pay the **$99/year**. Approval is usually a few hours, sometimes up to 2 days.
3. Note your **Team ID** (Account → Membership → Team ID, 10 chars).

Nothing iOS works until this is active.

## STEP 2 — Register the two app IDs · YOU
1. developer.apple.com → **Certificates, Identifiers & Profiles** → **Identifiers** → **＋**.
2. Type **App IDs** → **App** → Bundle ID **`com.hubsync.shop`**, description "HubSync Shop".
3. Scroll to **Capabilities** → tick **Push Notifications** → **Continue → Register**.
4. Repeat for **`com.hubsync.hub`** ("HubSync Hub").

## STEP 3 — APNs key (for push on iOS) · YOU
iOS push needs one Apple Push key (works for both apps):
1. developer.apple.com → **Keys** → **＋** → name "HubSync APNs" → tick **Apple Push Notifications service (APNs)** → **Continue → Register**.
2. **Download the `.p8` file** (you can only download once — keep it safe).
3. Note the **Key ID** (10 chars) shown on that page.

## STEP 4 — Firebase iOS apps + APNs upload · YOU
1. **console.firebase.google.com** → project **cafe-ops-platform** → **Add app** → **iOS**.
2. Bundle ID **`com.hubsync.shop`** → register → **download `GoogleService-Info.plist`** → rename it **`GoogleService-Info-shop.plist`**.
3. **Add app → iOS** again → bundle ID **`com.hubsync.hub`** → download → rename **`GoogleService-Info-hub.plist`**.
4. Firebase → **Project settings → Cloud Messaging** → **Apple app configuration** → **Upload** the `.p8` APNs key from Step 3, entering its **Key ID** + your **Team ID**. (Do this once; covers both apps.)

## STEP 5 — App Store Connect API key (lets CI upload to TestFlight) · YOU
1. **appstoreconnect.apple.com** → **Users and Access** → **Integrations** tab → **App Store Connect API** → **＋**.
2. Name "CI Upload", Access **App Manager** → **Generate**.
3. **Download the `.p8`** (once only). Note the **Key ID** and the **Issuer ID** (shown above the keys list).
4. Also under **Apps**, create the two app records (**＋ New App**) with the same bundle IDs, so TestFlight has somewhere to receive the builds. Platform iOS, pick any SKU.

## STEP 6 — Hand the secrets to the build · YOU (then I take over)
In GitHub → repo **Settings → Secrets and variables → Actions**, add:
- `APP_STORE_CONNECT_KEY_ID` — the Key ID from Step 5
- `APP_STORE_CONNECT_ISSUER_ID` — the Issuer ID from Step 5
- `APP_STORE_CONNECT_PRIVATE_KEY` — paste the **contents** of the Step 5 `.p8`
- `IOS_TEAM_ID` — your Team ID from Step 1

And send me (or commit to a private spot) the two `GoogleService-Info-*.plist` files.

## STEP 7 — I wire signing + TestFlight upload · ME
Once Steps 1–6 are done, I extend `build-ios.yml` to:
- inject the `GoogleService-Info.plist` per app,
- sign with the App Store Connect API key (automatic signing — no manual certs to juggle),
- build the signed `.ipa`,
- upload to **TestFlight**.
You'll then get a build in TestFlight within ~1 hour of each run.

## STEP 8 — Install on devices · YOU
1. appstoreconnect.apple.com → your app → **TestFlight** → **Internal Testing** → add your staff by email (they need a free Apple ID).
2. They install the **TestFlight** app from the App Store, accept the invite, install HubSync.
3. On first launch, tap **Allow** for notifications.
> Note: TestFlight builds expire after **90 days** — re-run the build to refresh.

---

## Cost & time summary
- **Cost:** $99/year (Apple). Everything else is free (public repo → free macOS CI).
- **Time:** code is ready today; ~1–2 days end-to-end, mostly waiting on Apple approval + portal clicks. Engineering (my side) is ~half a day after your Step 6.

## What's already done
- ✅ Both apps compile for iOS (CI `build-ios`, unsigned).
- ✅ Adaptive landscape layout → great on iPad (your wall-screen use-case).
- ✅ Push code is cross-platform; iOS just needs the APNs key wired (Steps 3–4).
