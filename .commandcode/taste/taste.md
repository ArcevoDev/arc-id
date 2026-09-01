# Documentation
See [documentation/taste.md](documentation/taste.md)
# Testing
- When fixing mock-db.ts for a flow test: check the actual flow file for ALL models/entities it reads, not just the one that surfaced in the first error. Confidence: 0.70
- Fix test failures caused by missing Zod defaults by adding the defaulted fields explicitly to test input objects, not by loosening the flow's type signature. Confidence: 0.70
- When verifying generated/render output (emails, HTML, snapshots), assert on the presence of the actual expected content, not just non-empty length or a passing exit code — a check that only verifies output length can falsely pass while body content is silently dropped (the mail-render check passed at >200 chars even though the email body never rendered). Confidence: 0.70

# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/
See [taste-(continuously-learned-by-[commandcode][cmd])/taste.md](taste-(continuously-learned-by-[commandcode][cmd])/taste.md)
# Workflow
See [workflow/taste.md](workflow/taste.md)
# architecture
See [architecture/taste.md](architecture/taste.md)
# git
See [git/taste.md](git/taste.md)
# security
- When revoking access tokens, always pair the blocklist call (blockJti) with the revocation DB write (revokedJti create/upsert) — never one without the other — and compute the TTL from the token's actual expiresAt (e.g., `Math.max(Math.ceil((expiresAt - now)/1000), 1)`), not a flat default. Confidence: 0.75
- Supply-chain policy verification on lockfiles is part of the standard `pnpm install` workflow — the user's environment automatically runs "Lockfile passes supply-chain policies" checks during installs and does not bypass these security gates. Confidence: 0.6
- When generating long-lived machine secrets (API keys, tokens), store only the SHA-256 hash (`@unique` for fast DB lookup) plus a short display prefix — never the plaintext; return plaintext only once at creation time, and authenticate by hash lookup on every subsequent request. Confidence: 0.8
