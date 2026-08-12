# architecture
- Keep pages thin: pages should only call components and hooks, never import SDK or stores directly. Confidence: 0.70
- The strict access chain — page → component → hook (use-*.ts) → store → SDK → API, no page/component imports the SDK directly — is a non-negotiable convention the user expects enforced in phase plans and tracker docs. Confidence: 0.75
- Reusable forms belong in a dedicated forms folder, not built inline in pages using shadcn form primitives. Confidence: 0.65
- Before starting new development phases, close out all audit gaps and bug fixes first — ensure no invisible gaps remain. Confidence: 0.70
- When migrating to a replacement component/dependency library (e.g., Radix → a shared facet-components library), remove the superseded dependency and any vendored local component folder once the swap is complete — don't keep both in the package. Confidence: 0.75
- Before deleting existing components during a migration, confirm each has a direct equivalent in the replacement package (export-for-export); if equivalents exist, safely delete instead of rebuilding to avoid duplication. Confidence: 0.7
- Prefer consuming a dependency's native API directly (e.g., `@arcevo/facet-components`' `<Icon name="…" />` full icon registry) over building a local registry/adapter that duplicates what the package already ships — update call sites to the package API instead (user: "i dont think we need to build another icon registry here, when we can just import Icon from components"). Confidence: 0.9
