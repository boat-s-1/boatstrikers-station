# Recovered migration credential-pattern scan

Date: 2026-11-18
Scope: all 133 reconstructed SQL payloads in `supabase/migrations_recovered/`.

## Result

- High-confidence credential/token pattern matches: **0**
- Generic configuration references containing terms such as `api_key`, `service_role`, `password`, or `secret`: **39**

The generic references are not themselves credential values. The scan deliberately reports counts only and does not print matched SQL fragments or values.

## Patterns checked

- GitHub classic token-like strings (`ghp_...`)
- GitHub fine-grained token-like strings (`github_pat_...`)
- Supabase secret-key-like strings (`sb_secret_...`)
- OpenAI-style secret-key-like strings (`sk-...`)
- JWT-shaped strings (`eyJ...` with three dot-separated segments)

## Limitations

This is a regex screen, not a full secret scanner. It may miss unfamiliar formats, split/encoded secrets, or values constructed dynamically. No secrets were intentionally copied into the manifest or audit documents. The recovered SQL should still be scanned with the repository's approved secret-scanning tool before any merge or external distribution.
