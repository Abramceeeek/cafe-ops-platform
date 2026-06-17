// Public support page — required for the App Store "Support URL" field.
// Reachable without login (see middleware.ts exemption). Plain static content.
export const metadata = {
  title: "HubSync — Support",
  description: "Support contact for the HubSync staff operations apps.",
};

export default function Support() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[15px] leading-relaxed text-neutral-800">
      <h1 className="text-2xl font-semibold text-neutral-900">HubSync — Support</h1>
      <p className="mt-1 text-sm text-neutral-500">Last updated: 17 June 2026</p>

      <p className="mt-6">
        HubSync is an internal operations tool for the bobo &amp; wild bakery and café team
        (HubSync Hub and HubSync Shop). It is used only by our own staff to place, fulfil, and
        deliver wholesale and shop orders. Accounts are created and managed by an administrator.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Getting help</h2>
      <p className="mt-2">
        If you are a staff member and need help signing in, a new account, a password reset, or you
        have hit a problem in the app, contact your administrator or email us at the address below.
        We aim to respond within one business day.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Contact</h2>
      <p className="mt-2">
        Email: <strong>abdurakhmonbekfayzullaev@gmail.com</strong>
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Privacy</h2>
      <p className="mt-2">
        See our <a className="underline" href="/privacy">Privacy Policy</a> for how we handle your data.
      </p>
    </main>
  );
}
