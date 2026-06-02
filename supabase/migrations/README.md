# supabase/migrations

Numbered SQL migrations, e.g. `0001_shops.sql`, `0002_profiles.sql`
(PROJECT_SPEC §5, ROADMAP 1.1).

**Rules (enforced by `CI / db-migration-guard`):**

- Never edit a committed migration — it is immutable. Add a new numbered file.
- Migration files are `*.sql`.

Schema itself is **Phase 1** work and is intentionally not present in this
Phase 0 scaffold.
