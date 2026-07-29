# Documentation
See [documentation/taste.md](documentation/taste.md)
# Testing
- When fixing mock-db.ts for a flow test: check the actual flow file for ALL models/entities it reads, not just the one that surfaced in the first error. Confidence: 0.70
- Fix test failures caused by missing Zod defaults by adding the defaulted fields explicitly to test input objects, not by loosening the flow's type signature. Confidence: 0.70

# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/
See [taste-(continuously-learned-by-[commandcode][cmd])/taste.md](taste-(continuously-learned-by-[commandcode][cmd])/taste.md)
# Workflow
- Before applying bulk doc updates, show diffs to the user for review first. Confidence: 0.60
- Before a frontend/architecture rebuild, first thoroughly audit both the upstream dependency codebase and the target codebase to build a complete overlap map of what to purge, keep, and refine. Confidence: 0.75
- When auditing a sibling or dependency codebase, produce a categorized analysis covering: what exists (inventory), consumption overlap map, blockers, design inconsistencies, and ranked optimization opportunities for scalability & third-party dynamism — each with actionable recommendations. Confidence: 0.70
- When automated exploration/subagent tools fail, fall back to manual systematic exploration (reading files one by one in a structured order) rather than retrying the failed automation. Confidence: 0.75

# architecture
- Keep pages thin: pages should only call components and hooks, never import SDK or stores directly. Confidence: 0.70
- Reusable forms belong in a dedicated forms folder, not built inline in pages using shadcn form primitives. Confidence: 0.65
- Before starting new development phases, close out all audit gaps and bug fixes first — ensure no invisible gaps remain. Confidence: 0.70

# git
- Use `chore:` prefix for commit messages when applying cleanup/fix work from code audits. Commit to the chore branch with well-defined messages, or alternatively to the specifically concerned branch. Confidence: 0.75
