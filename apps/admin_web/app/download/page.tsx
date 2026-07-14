// Public install page for the HubSync apps (iOS via TestFlight, Android via APK).
// Reachable without login (see middleware.ts exemption). Point abdurakhmonbek.com
// (or a subdomain) at this Vercel project and share e.g. abdurakhmonbek.com/download.

// iOS — TestFlight public links (App Store Connect → app → TestFlight → External → Public Link)
const TF_SHOP = "https://testflight.apple.com/join/Qp356Cpa"; // HubSync Shop
const TF_HUB = "https://testflight.apple.com/join/6GwBMuKP"; // HubSync Hub
const TESTFLIGHT_APP = "https://apps.apple.com/app/testflight/id899247664";

// Android — APKs hosted on the repo's latest GitHub Release (see the release step).
const APK_SHOP =
  "https://github.com/Abramceeeek/cafe-ops-platform/releases/latest/download/hubsync-shop.apk";
const APK_HUB =
  "https://github.com/Abramceeeek/cafe-ops-platform/releases/latest/download/hubsync-hub.apk";

export const metadata = {
  title: "Install HubSync",
  description: "Install the HubSync staff apps — iPhone (TestFlight) or Android (APK).",
};

function AppCard({
  name,
  tag,
  who,
  tf,
  apk,
}: {
  name: string;
  tag: string;
  who: string;
  tf: string;
  apk: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{name}</h2>
        <span className="rounded-full bg-[#e7f0ec] px-2.5 py-0.5 text-xs font-medium text-[#2f7d63]">
          {tag}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{who}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href={tf}
          className="flex flex-col items-center rounded-xl bg-[#2f7d63] px-3 py-3 text-center text-white"
        >
          <span className="text-sm font-semibold">iPhone</span>
          <span className="text-[11px] text-white/80">via TestFlight</span>
        </a>
        <a
          href={apk}
          className="flex flex-col items-center rounded-xl border border-neutral-300 px-3 py-3 text-center text-neutral-800"
        >
          <span className="text-sm font-semibold">Android</span>
          <span className="text-[11px] text-neutral-500">download APK</span>
        </a>
      </div>
    </div>
  );
}

export default function Download() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-neutral-800">
      <h1 className="text-center text-2xl font-semibold text-neutral-900">Install HubSync</h1>
      <p className="mt-2 text-center text-[15px] leading-relaxed text-neutral-600">
        Internal apps for the bobo &amp; wild team. Pick the app for your role, then your phone.
      </p>

      <div className="mt-8 space-y-4">
        <AppCard
          name="HubSync Shop"
          tag="Front of house"
          who="For café / shop managers — place and track orders to the bakery hub, reorder from templates, flag emergencies."
          tf={TF_SHOP}
          apk={APK_SHOP}
        />
        <AppCard
          name="HubSync Hub"
          tag="Production & delivery"
          who="For bakers, kitchen (pitmasters) and couriers — approve and adjust orders, mark them ready, and run deliveries."
          tf={TF_HUB}
          apk={APK_HUB}
        />
      </div>

      <div className="mt-8 rounded-xl bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-600">
        <p>
          <strong className="text-neutral-800">iPhone:</strong> first install the free{" "}
          <a className="underline" href={TESTFLIGHT_APP}>
            TestFlight
          </a>{" "}
          app, then tap your app above.
        </p>
        <p className="mt-2">
          <strong className="text-neutral-800">Android:</strong> tap “download APK”, then open the
          downloaded file and tap <em>Install</em> (allow installs from this source if asked).
        </p>
      </div>

      <p className="mt-8 text-center text-xs text-neutral-500">
        Accounts are provided by your administrator. Trouble installing? See{" "}
        <a className="underline" href="/support">
          Support
        </a>
        .
      </p>
    </main>
  );
}
