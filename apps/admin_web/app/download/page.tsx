// Public install page for the HubSync TestFlight builds. Reachable without login
// (see middleware.ts exemption). Point abdurakhmonbek.com (or a subdomain) at this
// Vercel project and share e.g. abdurakhmonbek.com/download with testers.
//
// ▼▼▼ REPLACE these two with your real TestFlight public links ▼▼▼
// (App Store Connect → each app → TestFlight → External group → enable Public Link
//  → Copy. Both need the group's first build approved by Beta App Review first.)
const TESTFLIGHT_HUB = "https://testflight.apple.com/join/Qp356Cpa"; // HubSync Hub
const TESTFLIGHT_SHOP = "https://testflight.apple.com/join/REPLACE_ME"; // HubSync Shop
// ▲▲▲ ------------------------------------------------------------ ▲▲▲

const TESTFLIGHT_APP = "https://apps.apple.com/app/testflight/id899247664";

export const metadata = {
  title: "Install HubSync",
  description: "Install the HubSync staff apps for iOS via TestFlight.",
};

export default function Download() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-neutral-800">
      <h1 className="text-center text-2xl font-semibold text-neutral-900">Install HubSync</h1>
      <p className="mt-2 text-center text-[15px] leading-relaxed text-neutral-600">
        Internal testing apps for the bobo &amp; wild team, installed on iPhone via
        Apple&nbsp;TestFlight.
      </p>

      <ol className="mt-8 space-y-6">
        <li>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="font-medium text-neutral-900">Install TestFlight (one time)</p>
              <a
                href={TESTFLIGHT_APP}
                className="mt-2 inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800"
              >
                Get TestFlight ↗
              </a>
            </div>
          </div>
        </li>

        <li>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
              2
            </span>
            <div className="w-full">
              <p className="font-medium text-neutral-900">Then install your app</p>
              <div className="mt-3 space-y-3">
                <a
                  href={TESTFLIGHT_HUB}
                  className="flex w-full items-center justify-between rounded-xl bg-[#2f7d63] px-5 py-4 text-white"
                >
                  <span>
                    <span className="block font-semibold">HubSync Hub</span>
                    <span className="block text-xs text-white/80">Bakers · kitchen · couriers</span>
                  </span>
                  <span aria-hidden>→</span>
                </a>
                <a
                  href={TESTFLIGHT_SHOP}
                  className="flex w-full items-center justify-between rounded-xl bg-[#2f7d63] px-5 py-4 text-white"
                >
                  <span>
                    <span className="block font-semibold">HubSync Shop</span>
                    <span className="block text-xs text-white/80">Café / shop managers</span>
                  </span>
                  <span aria-hidden>→</span>
                </a>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <p className="mt-10 text-center text-xs text-neutral-500">
        iPhone only. Trouble installing? See{" "}
        <a className="underline" href="/support">Support</a>.
      </p>
    </main>
  );
}
