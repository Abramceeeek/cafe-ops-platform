import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main style={{ maxWidth: 720, margin: "8vh auto", padding: 16 }}>
      <h1>HubSync Admin</h1>
      <p>Signed in as {user?.email ?? "unknown"}.</p>
      <p>Live Operations, Catalog, Finance, and Users land here next.</p>
      <SignOutButton />
    </main>
  );
}
