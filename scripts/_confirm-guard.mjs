// Safety guard for destructive ops scripts (audit C6).
// A bare `--confirm` only guards against invocation typos, not against a swapped or
// mis-edited keys.txt pointing at the wrong project. This forces the operator to name
// the exact Supabase project ref they intend to destroy — `--confirm <ref>` — and
// aborts unless it matches the ref derived from keys.txt's SUPABASE_URL.
export function assertConfirmedTarget(supabaseUrl, scriptName) {
  const ref = String(supabaseUrl || "").replace(/^https?:\/\//, "").split(".")[0];
  if (!ref) {
    console.error("ABORT: could not derive a project ref from SUPABASE_URL in keys.txt.");
    process.exit(1);
  }
  const i = process.argv.indexOf("--confirm");
  const passed = i !== -1 ? process.argv[i + 1] : undefined;
  if (passed !== ref) {
    console.error(`Refusing to run. This is DESTRUCTIVE against project "${ref}" (${supabaseUrl}).`);
    console.error(`Re-run and name the target explicitly:  node scripts/${scriptName} --confirm ${ref}`);
    process.exit(1);
  }
  return ref;
}
