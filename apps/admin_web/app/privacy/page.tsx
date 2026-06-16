// Public privacy policy — required for App Store (unlisted) distribution.
// Reachable without login (see middleware.ts exemption). Plain static content.
export const metadata = {
  title: "HubSync — Privacy Policy",
  description: "Privacy policy for the HubSync staff operations apps.",
};

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[15px] leading-relaxed text-neutral-800">
      <h1 className="text-2xl font-semibold text-neutral-900">HubSync — Privacy Policy</h1>
      <p className="mt-1 text-sm text-neutral-500">Last updated: 16 June 2026</p>

      <p className="mt-6">
        HubSync is an internal operations tool for the bobo &amp; wild bakery and café team. It is
        used only by our own staff to place, fulfil, and deliver wholesale and shop orders. It is
        not a consumer product and is not advertised or sold to the public. This policy explains
        what data the HubSync apps (HubSync Hub and HubSync Shop) collect and how we use it.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Information we collect</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><strong>Account information</strong> — your name, email address, role, and assigned shop. Staff accounts are created by an administrator.</li>
        <li><strong>Operational data</strong> — the orders, deliveries, quantities, and statuses you create or act on while doing your job.</li>
        <li><strong>Device token</strong> — a push-notification identifier, used solely to send you work alerts (e.g. a new order or a delivery update).</li>
      </ul>
      <p className="mt-2 text-sm text-neutral-600">
        We do <strong>not</strong> collect location, contacts, photos, advertising identifiers, or any
        usage-tracking data, and the app contains no third-party analytics or advertising.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">How we use it</h2>
      <p className="mt-2">
        Your data is used only to operate the internal ordering and delivery workflow and to send
        work-related notifications. We do not sell, rent, or share your data for marketing, and we
        do not use it for any purpose unrelated to running the business.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Service providers</h2>
      <p className="mt-2">
        We rely on trusted providers to run the app: <strong>Supabase</strong> (database and
        authentication), <strong>Google Firebase Cloud Messaging</strong> (push notifications), and
        <strong> Vercel</strong> (web hosting). Data is processed and stored on these platforms on our
        behalf and is not used by them for their own purposes.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Security &amp; retention</h2>
      <p className="mt-2">
        Access is restricted by role-based permissions, and all data is encrypted in transit
        (HTTPS/TLS). We keep your information while your staff account is active and remove or
        anonymise it when the account is deactivated or on request.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Your rights</h2>
      <p className="mt-2">
        You can request access to, correction of, or deletion of your personal data by contacting
        your administrator. Because accounts are staff-managed, account creation and removal are
        handled internally.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Children</h2>
      <p className="mt-2">HubSync is a staff-only tool and is not directed at or intended for children.</p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Changes</h2>
      <p className="mt-2">
        We may update this policy from time to time; the date at the top reflects the latest version.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Contact</h2>
      <p className="mt-2">
        Questions about this policy or your data: <strong>abdurakhmonbekfayzullaev@gmail.com</strong>.
      </p>
    </main>
  );
}
