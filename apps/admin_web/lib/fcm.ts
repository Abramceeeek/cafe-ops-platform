// Server-only FCM sender. Initialised from the Firebase service account JSON
// held in the FIREBASE_SERVICE_ACCOUNT env var (Vercel server env — never the
// client/APK). Used by the /api/notify-order route to push order alerts.
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function adminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

/** Push a notification to the given device tokens. Best-effort; returns counts. */
export async function sendPush(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ sent: number; failed: number }> {
  const valid = tokens.filter((t): t is string => !!t);
  if (valid.length === 0) return { sent: 0, failed: 0 };
  const res = await getMessaging(adminApp()).sendEachForMulticast({
    tokens: valid,
    notification: { title, body },
    data: data ?? {},
    android: { priority: "high" },
  });
  return { sent: res.successCount, failed: res.failureCount };
}
