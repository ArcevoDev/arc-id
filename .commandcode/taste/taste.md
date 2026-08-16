# Documentation
See [documentation/taste.md](documentation/taste.md)
# Testing
- When fixing mock-db.ts for a flow test: check the actual flow file for ALL models/entities it reads, not just the one that surfaced in the first error. Confidence: 0.70
- Fix test failures caused by missing Zod defaults by adding the defaulted fields explicitly to test input objects, not by loosening the flow's type signature. Confidence: 0.70

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
