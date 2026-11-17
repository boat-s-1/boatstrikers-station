# Hatsune NEWS — live uniqueness and replay read-only audit (2026-11-17)

Production Supabase `rzosrbkyniyedolhkgxo`, read-only queries of `pg_indexes` and `public.hatsune_news`:

- `hatsune_news_source_key_uidx` is a **UNIQUE btree index on source_key**.
- Total rows 1,645; `general:%` source-key rows 834.
- NULL source keys 4.
- Duplicate non-NULL source keys 0, computed as `count(source_key)-count(DISTINCT source_key)`.
- Duplicate-title groups 1 (titles not copied into audit report).

A previous aggregate using `count(*)-count(DISTINCT source_key)` returned 4; that expression **included the four NULL source keys**, so it was NOT a duplicate count. The corrected count is zero.

### Safety implications
The UNIQUE source-key index prevents two rows with the exact same non-NULL key, including concurrent inserts. It does not prevent multiple NULL keys, different source keys for the same article, or duplicate titles. Existing general-news sync performs pre-insert title and key checks followed by a plain insert, not an atomic upsert; concurrent writers can still hit a unique violation and return an error. Repair updates to existing published rows are separate side effects. The current evidence does **not** authorize rerunning the production GET endpoint.

No production changes. Release HOLD until isolated concurrent-write and partial-repair verification, independently reviewed integration, and explicit approval.
