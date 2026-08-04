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
- Keep pages thin: pages should only call components and hooks, never import SDK or stores directly. Confidence: 0.70
- Reusable forms belong in a dedicated forms folder, not built inline in pages using shadcn form primitives. Confidence: 0.65
- Before starting new development phases, close out all audit gaps and bug fixes first — ensure no invisible gaps remain. Confidence: 0.70

# git
- Use `chore:` prefix for commit messages when applying cleanup/fix work from code audits. Commit to the chore branch with well-defined messages, or alternatively to the specifically concerned branch. Confidence: 0.75
- Commit changes as individual logical commits grouped by scope (config, docs, frontend, components, modules, etc.) rather than one bulk commit, and push to remote to maintain a clean working history. Confidence: 0.75
- After IDE crashes or file corruption, proactively find and fix corrupted files (null files, broken JSON configs) before resuming development — commit and push to establish a clean slate. Confidence: 0.75
